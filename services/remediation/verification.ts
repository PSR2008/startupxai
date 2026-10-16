import { evidenceSchema } from "@launchgate/contracts";
import { evaluateOutcome, evidenceDigest } from "@launchgate/verification-core";
import { canonical, digest } from "../runner/metadata";
import { evaluateRelease, type ReleaseEvidence } from "../releases/engine";
import { releaseSchema, releasePolicySchema, type Release, type ReleasePolicy } from "../releases/contracts";
import { planHash, validatePlan, type TestPlan } from "../../reference-lab/plans";
import { type Proposal, type RemediationContext } from "./contracts";
import { adjacentCases, validateAutomaticPatch, type SupportedCase } from "./provider";

export function verifyResolution(input: { context: RemediationContext; proposal: Proposal; original: ReleaseEvidence; originalPlan: TestPlan;
  fixSha: string; release: Release; policy: ReleasePolicy; evidence: ReleaseEvidence[]; now: string }) {
  const { context: c, proposal: p, original, fixSha } = input;
  const patch = validateAutomaticPatch(c, p, c.sourceSha), plan = validatePlan(input.originalPlan), release = releaseSchema.parse(input.release), policy = releasePolicySchema.parse(input.policy);
  const old = evidenceSchema.parse(original.evidence);
  if (planHash(plan) !== c.planHash || plan.spec.id !== c.invariantId || plan.spec.version !== c.invariantVersion || old.scope.commitSha !== c.sourceSha || old.scope.deploymentId !== c.deploymentId || old.scope.organizationId !== c.organizationId || old.scope.projectId !== c.projectId || original.sealedManifestDigest !== c.originalManifest || evidenceDigest(old) !== original.manifestDigest || evaluateOutcome(plan.spec, old, original.admission).outcome !== "REPRODUCIBLE_FAILURE") throw new Error("ORIGIN_NOT_REPRODUCED");
  const reasons: string[] = [];
  for (const adjacent of adjacentCases[c.caseId as SupportedCase] ?? []) {
    if (!policy.requirements.some(r => r.required && r.baseline && r.invariant.provenance.references.includes(`reference-lab-v1:${adjacent}`))) reasons.push("ADJACENT_REGRESSION_MISSING");
  }
  if (fixSha === c.sourceSha || release.candidate.commitSha !== fixSha || release.deploymentCommitSha !== fixSha || release.candidate.deploymentId === c.deploymentId || release.candidate.organizationId !== c.organizationId || release.candidate.projectId !== c.projectId || !["SANDBOX", "STAGING", "PREVIEW"].includes(release.environment)) reasons.push("PREVIEW_BINDING");
  const requirement = policy.requirements.find(r => r.invariant.id === c.invariantId);
  if (!requirement?.required || requirement.planHash !== c.planHash || canonical(requirement.invariant) !== canonical(plan.spec)) reasons.push("ORIGINAL_ORACLE_CHANGED");
  const evaluation = evaluateRelease({ release, policy, evidence: input.evidence, now: input.now });
  const replay = evaluation.coverage.find(i => i.invariantId === c.invariantId);
  const status = reasons.length ? "INCONCLUSIVE" : replay?.status === "REPRODUCIBLE_FAILURE" ? "VERIFICATION_FAILED" : evaluation.coverage.some(i => i.required && i.status === "REPRODUCIBLE_FAILURE") ? "VERIFICATION_FAILED" : evaluation.decision === "SHIP" && replay?.status === "PASS" && evaluation.coverage.every(i => !i.required || i.status === "PASS") ? "VERIFIED" : "INCONCLUSIVE";
  const evidence = { version: 1, findingId: c.findingId, proposalId: p.id, patchHash: patch.patchHash, vulnerableSha: c.sourceSha, vulnerableDeployment: c.deploymentId, fixSha, fixDeployment: release.candidate.deploymentId,
    originalManifest: c.originalManifest, planHash: c.planHash, releaseId: release.id, replayInvariant: c.invariantId, coverage: evaluation.coverage, manifests: evaluation.manifests, evaluatedAt: input.now, validUntil: evaluation.validUntil, status, reasons: [...reasons, ...evaluation.reasons] };
  return { status, evidence, manifest: digest(canonical(evidence)), evaluation };
}
export function fixCheck(status: "VERIFIED" | "VERIFICATION_FAILED" | "INCONCLUSIVE", findingId: string) {
  return { conclusion: status === "VERIFIED" ? "success" as const : status === "VERIFICATION_FAILED" ? "failure" as const : "action_required" as const,
    title: status === "VERIFIED" ? "Fix verified for tested scope" : status === "VERIFICATION_FAILED" ? "Reproduced failure remains in required verification" : "Fix assurance incomplete",
    summary: `Finding: ${findingId}\nExact replay, positive controls and required regressions: ${status}. Human merge required.` };
}
