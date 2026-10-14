import { evidenceSchema, sameCandidate, type EvidenceAdmission } from "@launchgate/contracts";
import { evaluateOutcome, evidenceDigest } from "@launchgate/verification-core";
import { canonical, digest } from "../runner/metadata";
import { exceptionSchema, releasePolicySchema, releaseSchema, type PolicyException, type Release, type ReleasePolicy, type Requirement } from "./contracts";

export const ENGINE_VERSION = "lg-release-1";
export const coverageStatuses = ["PASS", "REPRODUCIBLE_FAILURE", "INCONCLUSIVE", "NOT_APPLICABLE", "NOT_RUN", "STALE"] as const;
export type CoverageStatus = typeof coverageStatuses[number];
// Only the trusted store/manifest loader constructs these envelopes. HTTP input
// never supplies an admission, authorization status or freshness metadata.
export interface ReleaseEvidence {
  invariantId: string; evidence: unknown; admission: EvidenceAdmission; manifestDigest: string;
  sealedManifestDigest?: string;
  authorization: { id: string; expiresAt: string; revokedAt: string | null };
  testVersion: string; fixtureVersion: number; planHash: string;
}
export interface FindingContext {
  id: string; invariantId: string; invariantVersion: number; state: string;
  origin: ReleaseEvidence;
  // Persisted dependency proof, not a boolean supplied by a client. The loader
  // verifies the complete transitive file set against both stored snapshots.
  unchangedProof: { releaseId: string; invariantVersion: number; digest: string; complete: boolean } | null;
  regressionInvariantId: string | null;
}
export interface CoverageItem {
  invariantId: string; required: boolean; kind: Requirement["kind"]; status: CoverageStatus;
  severity: Requirement["invariant"]["severity"];
  reason: string; manifestDigest: string | null; exceptionId: string | null;
}
export interface ReleaseEvaluation {
  engineVersion: typeof ENGINE_VERSION; releaseId: string; candidate: Release["candidate"];
  policyVersion: number; policyDigest: string; evaluatedAt: string;
  validUntil: string | null;
  decision: "SHIP" | "BLOCK" | "INCONCLUSIVE"; reasons: string[];
  coverage: CoverageItem[]; counts: Record<CoverageStatus, number> & { requiredTotal: number; applicableTotal: number };
  findings: Array<{ id: string; applicability: "EXACT" | "UNCHANGED" | "RESOLVED_REGRESSION_PASSED" | "NOT_ESTABLISHED"; blocking: boolean }>;
  regressions: string[]; exceptions: string[]; manifests: string[];
}
export function invariantSetDigest(policy: ReleasePolicy): string {
  return digest(canonical(policy.requirements.map(r => ({ id: r.invariant.id, version: r.invariant.version, planHash: r.planHash })).sort((a,b) => a.id.localeCompare(b.id))));
}
function validException(w: PolicyException, release: Release, p: ReleasePolicy, invariantId: string, findingId: string | null, now: number) {
  return p.allowExceptions && w.organizationId === release.candidate.organizationId && w.projectId === release.candidate.projectId &&
    w.releaseId === release.id && w.policyId === p.id && w.policyVersion === p.version && w.invariantId === invariantId && w.findingId === findingId &&
    w.revokedAt === null && Date.parse(w.createdAt) <= now && Date.parse(w.expiresAt) > now &&
    Date.parse(w.expiresAt) > Date.parse(w.createdAt) && Date.parse(w.expiresAt) - Date.parse(w.createdAt) <= p.maximumExceptionSeconds * 1000;
}
function classify(r: Requirement, records: readonly ReleaseEvidence[], release: Release, policy: ReleasePolicy, now: number): CoverageItem {
  const item: CoverageItem = { invariantId: r.invariant.id, severity:r.invariant.severity, required: r.required, kind: r.kind, status: "NOT_RUN", reason: "MISSING_RUN", manifestDigest: null, exceptionId: null };
  if (r.invariant.applicability.status === "NOT_APPLICABLE") {
    if (r.invariant.confirmation.status === "CONFIRMED" && r.applicabilityProof?.commitSha === release.candidate.commitSha && r.applicabilityProof.snapshotId === release.snapshotId)
      return { ...item, status: "NOT_APPLICABLE", reason: "EXPLICIT_APPLICABILITY_PROOF" };
    return { ...item, status: "INCONCLUSIVE", reason: "APPLICABILITY_NOT_ESTABLISHED" };
  }
  const matches = records.filter(e => e.invariantId === r.invariant.id);
  if (!matches.length) return item;
  if (matches.length !== 1) return { ...item, status: "INCONCLUSIVE", reason: "AMBIGUOUS_COVERAGE" };
  const record = matches[0], parsed = evidenceSchema.safeParse(record.evidence);
  if (!parsed.success || record.admission.kind === "UNTRUSTED" || evidenceDigest(parsed.data) !== record.manifestDigest)
    return { ...item, status: "INCONCLUSIVE", reason: "UNTRUSTED_MANIFEST" };
  const e = parsed.data;
  item.manifestDigest = record.sealedManifestDigest ?? record.manifestDigest;
  const time = Date.parse(e.createdAt);
  if (!sameCandidate(e.scope, release.candidate) || e.scope.invariantVersion !== r.invariant.version ||
      e.runner.version !== r.runnerVersion || record.testVersion !== r.testVersion || record.fixtureVersion !== r.fixtureVersion || record.planHash !== r.planHash ||
      time > now || now - time > policy.freshnessSeconds * 1000 || Date.parse(e.original.completedAt) > time ||
      (e.reproduction.status === "REPRODUCED" && Date.parse(e.reproduction.attempt.completedAt) > time))
    return { ...item, status: "STALE", reason: "EVIDENCE_IDENTITY_OR_AGE_CHANGED" };
  if (record.authorization.revokedAt || !Number.isFinite(Date.parse(record.authorization.expiresAt)) || Date.parse(record.authorization.expiresAt) <= now)
    return { ...item, status: "STALE", reason: "AUTHORIZATION_EXPIRED_OR_REVOKED" };
  const result = evaluateOutcome(r.invariant, e, record.admission);
  return { ...item, status: result.outcome, reason: result.reason };
}
export function evaluateRelease(input: {
  release: Release; policy: ReleasePolicy; evidence: readonly ReleaseEvidence[];
  findings?: readonly FindingContext[]; exceptions?: readonly PolicyException[]; now: string;
}): ReleaseEvaluation {
  const release = releaseSchema.parse(input.release), policy = releasePolicySchema.parse(input.policy), now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error("INVALID_EVALUATION_TIME");
  const exceptions = (input.exceptions ?? []).map(w => exceptionSchema.parse(w));
  const identityValid = release.candidate.policyId === policy.id && release.candidate.policyVersion === policy.version &&
    release.headSha === release.candidate.commitSha && release.deploymentCommitSha === release.candidate.commitSha &&
    release.invariantSetDigest === invariantSetDigest(policy) && policy.environments.includes(release.environment) && Date.parse(release.createdAt) <= now;
  const coverage = policy.requirements.map(r => classify(r, input.evidence, release, policy, now));
  const counts: ReleaseEvaluation["counts"] = { requiredTotal: 0, applicableTotal: 0, PASS: 0, REPRODUCIBLE_FAILURE: 0, INCONCLUSIVE: 0, NOT_APPLICABLE: 0, NOT_RUN: 0, STALE: 0 };
  const reasons: string[] = [], applied = new Set<string>();
  let blocked = false, incomplete = !identityValid;
  if (!identityValid) reasons.push("RELEASE_IDENTITY_OR_POLICY_MISMATCH");
  for (const item of coverage) {
    const r = policy.requirements.find(r => r.invariant.id === item.invariantId)!;
    const waiver = exceptions.find(w => validException(w, release, policy, item.invariantId, null, now) || (item.status === "REPRODUCIBLE_FAILURE" &&
      (input.findings??[]).some(f=>{
        if(f.id!==w.findingId||f.invariantId!==item.invariantId||!validException(w,release,policy,item.invariantId,f.id,now))return false;
        const origin=evidenceSchema.safeParse(f.origin.evidence),current=evidenceSchema.safeParse(input.evidence.find(e=>e.invariantId===item.invariantId)?.evidence);
        return origin.success&&current.success&&sameCandidate(origin.data.scope,release.candidate)&&origin.data.scope.invariantVersion===r.invariant.version&&
          evidenceDigest(origin.data)===f.origin.manifestDigest&&evaluateOutcome(r.invariant,origin.data,f.origin.admission).outcome==="REPRODUCIBLE_FAILURE"&&origin.data.original.failureSignature===current.data.original.failureSignature;
      })));
    if (waiver && item.status !== "PASS" && item.status !== "NOT_APPLICABLE") { item.exceptionId = waiver.id; applied.add(waiver.id); }
    if (item.required) { counts.requiredTotal++; counts[item.status]++; if (item.status !== "NOT_APPLICABLE") counts.applicableTotal++; }
    if (!item.exceptionId) {
      if (identityValid && item.status === "REPRODUCIBLE_FAILURE" && policy.blockingSeverities.includes(r.invariant.severity)) blocked = true;
      if (item.required && !["PASS", "NOT_APPLICABLE"].includes(item.status)) incomplete = true;
    }
  }
  const findings: ReleaseEvaluation["findings"] = [];
  for (const f of input.findings ?? []) {
    const r = policy.requirements.find(r => r.invariant.id === f.invariantId && r.invariant.version === f.invariantVersion);
    let applicability: ReleaseEvaluation["findings"][number]["applicability"] = "NOT_ESTABLISHED", blocking = false;
    if (r) {
      const origin = evidenceSchema.safeParse(f.origin.evidence);
      const reproduced = origin.success && evidenceDigest(origin.data) === f.origin.manifestDigest && evaluateOutcome(r.invariant, origin.data, f.origin.admission).outcome === "REPRODUCIBLE_FAILURE";
      const regressionPassed = f.regressionInvariantId && coverage.some(c => c.invariantId === f.regressionInvariantId && c.kind === "REGRESSION" && c.status === "PASS");
      if (f.state === "RESOLVED" && regressionPassed) applicability = "RESOLVED_REGRESSION_PASSED";
      else if (reproduced && origin.success && sameCandidate(origin.data.scope, release.candidate)) applicability = "EXACT";
      else if (reproduced && origin.success && origin.data.scope.organizationId === release.candidate.organizationId && origin.data.scope.projectId === release.candidate.projectId &&
        f.state !== "RESOLVED" && f.state !== "DISMISSED" && f.unchangedProof?.complete && f.unchangedProof.releaseId === release.id && f.unchangedProof.invariantVersion === r.invariant.version && /^sha256:[a-f0-9]{64}$/.test(f.unchangedProof.digest)) applicability = "UNCHANGED";
      const waiver = exceptions.find(w => validException(w, release, policy, f.invariantId, f.id, now) || validException(w, release, policy, f.invariantId, null, now));
      if (waiver && ["EXACT", "UNCHANGED"].includes(applicability)) applied.add(waiver.id);
      blocking = identityValid && ["EXACT", "UNCHANGED"].includes(applicability) && policy.blockingSeverities.includes(r.invariant.severity) && !waiver;
      if (applicability === "NOT_ESTABLISHED" && f.state !== "DISMISSED" && r.required) { incomplete = true; reasons.push("FINDING_APPLICABILITY_UNRESOLVED"); }
    }
    findings.push({ id: f.id, applicability, blocking }); blocked ||= blocking;
  }
  const decision = blocked ? "BLOCK" : incomplete || counts.applicableTotal === 0 ? "INCONCLUSIVE" : "SHIP";
  const deadlines=[now+policy.freshnessSeconds*1000,...exceptions.filter(w=>applied.has(w.id)).map(w=>Date.parse(w.expiresAt))];
  for(const item of coverage.filter(c=>c.required&&c.status==="PASS")){
    const record=input.evidence.find(e=>e.invariantId===item.invariantId),parsed=evidenceSchema.safeParse(record?.evidence);
    if(record&&parsed.success)deadlines.push(Date.parse(parsed.data.createdAt)+policy.freshnessSeconds*1000,Date.parse(record.authorization.expiresAt));
  }
  reasons.push(decision === "BLOCK" ? "REPRODUCED_POLICY_VIOLATION" : decision === "SHIP" ? "REQUIRED_SCOPE_SATISFIED" : "REQUIRED_ASSURANCE_INCOMPLETE");
  return { engineVersion: ENGINE_VERSION, releaseId: release.id, candidate: release.candidate, policyVersion: policy.version, policyDigest: digest(canonical(policy)), evaluatedAt: new Date(now).toISOString(),
    decision, validUntil:decision==="SHIP"?new Date(Math.min(...deadlines)).toISOString():null, reasons: [...new Set(reasons)].sort(), coverage, counts, findings, regressions: coverage.filter(c => c.kind === "REGRESSION").map(c => c.invariantId),
    exceptions: [...applied].sort(), manifests: [...new Set([...coverage.flatMap(c => c.manifestDigest ? [c.manifestDigest] : []),...(input.findings??[]).map(f=>f.origin.sealedManifestDigest??f.origin.manifestDigest)])].sort() };
}
