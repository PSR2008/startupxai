import { randomUUID } from "node:crypto";
import { z } from "zod";
import { evidenceSchema } from "@launchgate/contracts";
import { evidenceDigest } from "@launchgate/verification-core";
import { canonical, digest } from "../runner/metadata";
import { releaseSchema, releasePolicySchema, type PolicyException } from "./contracts";
import { evaluateRelease, type ReleaseEvidence, type FindingContext, type ReleaseEvaluation } from "./engine";
import { selectVerification, conservativeDependencies, type SourceSnapshot, type VerificationDependency } from "./impact";
import { checkOutput } from "./checks";
import { unchangedDependencyProof } from "./applicability";
import { validatePlan, planHash, type TestPlan, type Variant } from "../../reference-lab/plans";

export interface ReleaseStore { command(action: string, data: Record<string, unknown>): Promise<unknown> }
export interface ReleaseCheckPublisher { publishCheck(input: { installationId: number; repositoryId: number; headSha: string; externalId: string; conclusion: "success" | "failure" | "action_required"; title: string; summary: string }, checkpoint: () => Promise<void>): Promise<{ checkId: number; headSha: string }> }
const uuid = z.string().uuid();
const runSchema = z.object({ invariantId: uuid, run: z.object({ id: uuid, state: z.string(), commit_sha: z.string(), deployment_id: uuid, organization_id: uuid, project_id: uuid }),
  authorization: z.object({ id: uuid, expires_at: z.string(), revoked_at: z.string().nullable() }), proof: z.object({ expires_at: z.string(), revoked_at: z.string().nullable() }), bundle: z.unknown().nullable(), manifestDigest: z.string().nullable() });
type StoredRun = z.infer<typeof runSchema>;
// The sealed reproduction bundle is verified before its evidence is admitted.
export function loadReleaseEvidence(input: StoredRun): ReleaseEvidence | null {
  if (input.run.state !== "COMPLETED" || !input.bundle || !input.manifestDigest || digest(canonical(input.bundle)) !== input.manifestDigest) return null;
  const bundle = z.object({ evidence: evidenceSchema, plan: z.unknown(), planHash: z.string(), fixtureVersion: z.number(), authorizationId: uuid, runId: uuid }).parse(input.bundle);
  const e = bundle.evidence, plan = validatePlan(bundle.plan);
  if (e.runId !== input.run.id || bundle.runId !== input.run.id || bundle.authorizationId !== input.authorization.id || e.scope.invariantId !== input.invariantId ||
      e.scope.organizationId !== input.run.organization_id || e.scope.projectId !== input.run.project_id || e.scope.commitSha !== input.run.commit_sha || e.scope.deploymentId !== input.run.deployment_id || bundle.planHash !== planHash(plan)) return null;
  return { invariantId: input.invariantId, evidence: e, admission: e.scope.purpose === "REFERENCE_LAB" ? { kind: "REFERENCE_LAB" } : { kind: "AUTHENTICATED_RUNNER", runId: e.runId, manifestDigest: evidenceDigest(e) }, manifestDigest: evidenceDigest(e), sealedManifestDigest:input.manifestDigest,
    authorization: { id: input.authorization.id, expiresAt: new Date(Math.min(Date.parse(input.authorization.expires_at), Date.parse(input.proof.expires_at))).toISOString(), revokedAt: input.authorization.revoked_at ?? input.proof.revoked_at },
    testVersion: "lab-test-1", fixtureVersion: bundle.fixtureVersion, planHash: bundle.planHash };
}
const contextSchema = z.object({ release: releaseSchema, policy: releasePolicySchema, state: z.string(), generation: z.number().int().positive(), runs: z.array(runSchema),
  exceptions: z.array(z.object({ id: uuid, organization_id: uuid, project_id: uuid, release_id: uuid, invariant_id: uuid, finding_id: uuid.nullable(), reason: z.string(), actor_id: uuid, actor_role: z.enum(["OWNER", "ADMIN"]), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable(), ticket: z.string().nullable() })),
  findings: z.array(z.object({ id: uuid, invariant_id: uuid, invariant_version: z.number(), state: z.string(), origin: runSchema.nullable().optional(), regression_invariant_id: uuid.nullable().optional() })),
  dependencies: z.array(z.unknown()), evaluation: z.object({ id: uuid, evaluation: z.unknown() }).nullable(),
  selection:z.object({selected:z.array(z.object({invariantId:z.string()}))}).nullable().optional(),checkStartedGeneration:z.number().optional(),
  check: z.object({ publication_state: z.string() }).nullable(), repository: z.object({ repositoryId: z.number(), installationId: z.number() }).nullable() });
export class ReleaseWorker {
  readonly workerId = randomUUID();
  constructor(private readonly store: ReleaseStore, private readonly options: {
    publisher?: ReleaseCheckPublisher;
    processSnapshot?: (id: string) => Promise<unknown>;
    // Operator-owned registered plans only. No browser/customer code, URLs or secrets.
    lab?: { identity: () => { revision: string; sourceDigest: string }; plans: Map<string, { plan: TestPlan; variant: Variant; findingId?: string }> };
  } = {}) {}
  async tick(): Promise<ReleaseEvaluation | null> {
    await this.store.command("DISCOVER", {});
    if(this.options.processSnapshot){const ids=z.array(uuid).max(10).parse(await this.store.command("PENDING_SNAPSHOTS",{}));for(const id of ids)await this.options.processSnapshot(id);await this.store.command("DISCOVER",{});}
    const claim = await this.store.command("CLAIM", { workerId: this.workerId });
    if (!claim) return null;
    const lease = { ...z.object({ releaseId: uuid, fence: z.number().int().positive(), generation: z.number().int().positive() }).parse(claim), workerId: this.workerId };
    const checkpoint = async () => { await this.store.command("CHECK", lease); };
    try {
      let context = contextSchema.parse(await this.store.command("LOAD", lease));
      if(context.state!=="DECIDED"&&context.repository&&this.options.publisher&&context.checkStartedGeneration!==context.generation){
        const pending=evaluateRelease({release:context.release,policy:context.policy,evidence:[],now:new Date().toISOString()});
        await this.options.publisher.publishCheck({...context.repository,headSha:context.release.headSha,externalId:`lg:${context.release.repositoryConnectionId}:${context.release.headSha}`,...checkOutput(pending)},checkpoint);
        await this.store.command("CHECK_STARTED",lease);
      }
      if (context.state === "READY") {
        const source = await this.store.command("SOURCES", lease) as { head: SourceSnapshot | null; base: SourceSnapshot | null };
        if(source.head){
          for(const mapping of conservativeDependencies(source.head,context.policy)){
            const finding=context.findings.find(f=>f.invariant_id===mapping.invariantId);
            await this.store.command("DEPENDENCY",{...lease,mapping,findingId:finding?.id??null});
          }
        }
        const selection = selectVerification({ base: source.base, head: source.head ?? { id: context.release.id, connectionId: "REFERENCE_LAB", commitSha: context.release.candidate.commitSha, files: [], report: null },
          policy: context.policy, dependencies: context.dependencies as VerificationDependency[], regressions: context.findings.map(f => ({ invariantId: f.regression_invariant_id ?? f.invariant_id, state: f.state, severity: context.policy.requirements.find(r => r.invariant.id === f.invariant_id)?.invariant.severity ?? "critical", recent: true })) });
        await this.store.command("SELECTION", { ...lease, selection });
        context = contextSchema.parse(await this.store.command("LOAD", lease));
      }
      if (context.state === "VERIFYING" || context.state === "EVALUATING") {
        for (const requirement of context.policy.requirements) {
          if(context.selection&&!context.selection.selected.some(s=>s.invariantId===requirement.invariant.id))continue;
          if (context.runs.some(r => r.invariantId === requirement.invariant.id)) continue;
          const registered = this.options.lab?.plans.get(requirement.invariant.id);
          if (context.release.provider !== "REFERENCE_LAB" || !registered) continue;
          const plan = validatePlan(registered.plan);
          if (planHash(plan) !== requirement.planHash || canonical(plan.spec) !== canonical(requirement.invariant)) throw new Error("RELEASE_PLAN_CHANGED");
          await checkpoint();
          await this.store.command("SCHEDULE_LAB", { ...lease, findingId: registered.findingId ?? null, run: { plan, planHash: planHash(plan), variant: registered.variant,
            requestKey: randomUUID(), ...this.options.lab!.identity() } });
        }
        context = contextSchema.parse(await this.store.command("LOAD", lease));
        if (context.runs.some(r => !["COMPLETED", "CANCELLED", "FAILED_INFRASTRUCTURE"].includes(r.run.state))) return null;
        const evidence = context.runs.flatMap(r => { const loaded = loadReleaseEvidence(r); return loaded ? [loaded] : []; });
        const exceptions: PolicyException[] = context.exceptions.map(w => ({ id: w.id, organizationId: w.organization_id, projectId: w.project_id, releaseId: w.release_id, policyId: context.policy.id, policyVersion: context.policy.version, invariantId: w.invariant_id, findingId: w.finding_id, reason: w.reason, actorId: w.actor_id, actorRole: w.actor_role, createdAt: new Date(w.created_at).toISOString(), expiresAt: new Date(w.expires_at).toISOString(), revokedAt: w.revoked_at ? new Date(w.revoked_at).toISOString() : null, ticket: w.ticket }));
        const findings: FindingContext[] = [];
        for (const finding of context.findings) {
          const origin = finding.origin ? loadReleaseEvidence(finding.origin) : null;
          if (origin) {
            let proof:FindingContext["unchangedProof"]=null;
            const requirement=context.policy.requirements.find(r=>r.invariant.id===finding.invariant_id);
            if(requirement&&context.release.snapshotId){
              const previous=await this.store.command("FINDING_SOURCE",{...lease,findingId:finding.id}) as SourceSnapshot|null;
              const source=await this.store.command("SOURCES",lease) as {head:SourceSnapshot|null};
              if(previous&&source.head)proof=unchangedDependencyProof(context.release,requirement,previous,source.head,context.dependencies as VerificationDependency[]);
            }
            findings.push({ id: finding.id, invariantId: finding.invariant_id, invariantVersion: finding.invariant_version, state: finding.state, origin, unchangedProof: proof, regressionInvariantId: finding.regression_invariant_id ?? null });
          }
          else if (context.policy.requirements.some(r => r.required && r.invariant.id === finding.invariant_id)) {
            // Missing historical provenance is not silently ignored. Its affected
            // required coverage cannot supply approval until resolved.
            const entry = evidence.find(e => e.invariantId === finding.invariant_id); if (entry) entry.admission = { kind: "UNTRUSTED" };
          }
        }
        const evaluation = evaluateRelease({ release: context.release, policy: context.policy, evidence, findings, exceptions, now: new Date().toISOString() });
        const bundles = context.runs.map(r => r.bundle).filter(Boolean) as Array<{ attempts?: Array<{ requests: number; durationMs: number }> }>;
        await this.store.command("COMPLETE", { ...lease, evaluation, actualCost: bundles.reduce((sum,b) => sum + (b.attempts ?? []).reduce((n,a) => n + a.requests, 0), 0), durationMs: bundles.reduce((sum,b) => sum + (b.attempts ?? []).reduce((n,a) => n + a.durationMs, 0), 0) });
        context = contextSchema.parse(await this.store.command("LOAD", lease));
      }
      if (context.check?.publication_state === "PENDING" && context.evaluation && context.repository && this.options.publisher) {
        const evaluation = context.evaluation.evaluation as ReleaseEvaluation;
        await checkpoint();
        const published = await this.options.publisher.publishCheck({ ...context.repository, headSha: context.release.headSha, externalId: `lg:${context.release.repositoryConnectionId}:${context.release.headSha}`, ...checkOutput(evaluation) }, checkpoint);
        await this.store.command("PUBLISHED", { ...lease, evaluationId: context.evaluation.id, checkId: published.checkId });
      }
      return context.evaluation?.evaluation as ReleaseEvaluation ?? null;
    } finally { await this.store.command("RELEASE", lease).catch(() => {}); }
  }
  async run(signal: AbortSignal) {
    while (!signal.aborted) {
      try { await this.tick(); } catch { /* Durable lease retries; no sensitive payload logging. */ }
      await new Promise<void>(resolve => { const timer = setTimeout(done, 1000); function done() { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); } signal.addEventListener("abort", done, { once: true }); });
    }
  }
}
