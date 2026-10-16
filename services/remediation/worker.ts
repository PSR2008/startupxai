import { randomUUID } from "node:crypto";
import { z } from "zod";
import { digest } from "../runner/metadata";
import { loadReleaseEvidence } from "../releases/worker";
import { releaseSchema, releasePolicySchema, type Release, type ReleasePolicy } from "../releases/contracts";
import type { ReleaseEvidence } from "../releases/engine";
import { validatePlan, type TestPlan } from "../../reference-lab/plans";
import { labSourceIdentity, type RegisteredLabPreview } from "../../reference-lab/host";
import { contextSchema, proposalSchema, type RemediationContext, type RemediationProvider, type RemediationStore } from "./contracts";
import { generateProposal, templateSource, validateAutomaticPatch } from "./provider";
import { inPatchWorkspace } from "./patch";
import { withRegisteredPreview } from "./preview";
import { verifyResolution } from "./verification";
import { architectureDigest } from "./architecture";

const loadedSchema = z.object({ request: z.object({ id: z.string().uuid(), organization_id: z.string().uuid(), project_id: z.string().uuid(), finding_id: z.string().uuid(), source_sha: z.string(), requested_by: z.string().uuid(), mode: z.string(), next_action: z.string(), created_at: z.string() }),
  original: z.unknown(), policy: releasePolicySchema,
  artifact: z.object({ context: contextSchema, proposal: proposalSchema, patch_hash: z.string() }).nullable(),
  pullRequest: z.object({ fix_sha: z.string() }).nullable() });
export interface VerificationDriverInput { preview: RegisteredLabPreview; context: RemediationContext; plan: TestPlan; policy: ReleasePolicy; proposalId: string; actorId: string; checkpoint(): Promise<void>; prepareRelease(): Promise<Release>; loadResults(): Promise<ReleaseEvidence[]>; abandon(): Promise<void> }
export interface VerificationDriverResult { release: Release; policy: ReleasePolicy; evidence: ReleaseEvidence[] }
export class RemediationWorker {
  readonly workerId = randomUUID();
  constructor(private readonly store: RemediationStore, private readonly provider: RemediationProvider, private readonly verify: (input: VerificationDriverInput) => Promise<VerificationDriverResult>, private readonly onError?: (error: unknown) => void) {}
  async tick(signal?: AbortSignal) {
    signal?.throwIfAborted();
    const claim = await this.store.command("CLAIM", { workerId: this.workerId }); if (!claim) return null;
    const lease = z.object({ proposalId: z.string().uuid(), workerId: z.string().uuid(), fence: z.number().int().positive() }).parse(claim);
    const checkpoint = async () => { signal?.throwIfAborted(); await this.store.command("CHECK", lease); };
    let renewing = false;
    const timer = setInterval(() => { if (!renewing) { renewing = true; checkpoint().catch(() => {}).finally(() => { renewing = false; }); } }, 15000);
    try {
      const data = loadedSchema.parse(await this.store.command("LOAD", lease)), req = data.request;
      const raw = data.original as Parameters<typeof loadReleaseEvidence>[0], original = loadReleaseEvidence(raw);
      if (!original) throw new Error("ORIGINAL_MANIFEST_UNAVAILABLE");
      const plan = validatePlan(z.object({ plan: z.unknown() }).parse(raw.bundle).plan);
      if (req.mode !== "REFERENCE_LAB") throw new Error("CUSTOMER_ADAPTER_UNAVAILABLE");
      if (req.next_action === "GENERATE") {
        const { file } = templateSource(plan.caseId);
        if (req.source_sha !== labSourceIdentity().revision) throw new Error("STALE");
        const context: RemediationContext = contextSchema.parse({ organizationId: req.organization_id, projectId: req.project_id, findingId: req.finding_id,
          invariantId: plan.spec.id, invariantVersion: plan.spec.version, sourceSha: req.source_sha, deploymentId: raw.run.deployment_id, connectionId: null,
          planHash: original.planHash, originalManifest: raw.manifestDigest, reproduced: true, files: [file], allowedPaths: [file.path], provenance: "REGISTERED_REFERENCE_LAB", caseId: plan.caseId, architectureDigest: architectureDigest([file]) });
        const proposal = { ...await generateProposal(this.provider, context), id: req.id };
        await checkpoint(); return await this.store.command("GENERATED", { ...lease, context, proposal, patchHash: digest(proposal.diff) });
      }
      if (!data.artifact) throw new Error("PROPOSAL_UNAVAILABLE");
      const { context, proposal } = data.artifact;
      if (digest(proposal.diff) !== data.artifact.patch_hash) throw new Error("PATCH_CHANGED");
      const patch = validateAutomaticPatch(context, proposal, labSourceIdentity().revision);
      if (req.next_action === "VALIDATE") {
        await inPatchWorkspace(patch, async () => checkpoint());
        return await this.store.command("VALIDATED", lease);
      }
      const outcome = await withRegisteredPreview(context, proposal, labSourceIdentity().revision, async preview => {
        if (req.next_action === "PR") {
          await checkpoint();
          return this.store.command("PR_CREATED", { ...lease, branch: `launchgate/fix/${req.finding_id}-${req.id}`, fixSha: preview.identity().revision });
        }
        if (req.next_action !== "VERIFY" || data.pullRequest?.fix_sha !== preview.identity().revision) throw new Error("PREVIEW_MISMATCH");
        const result = await this.verify({ preview, context, plan, policy: data.policy, proposalId: req.id, actorId: req.requested_by, checkpoint,
          abandon: async () => { await this.store.command("ABANDON",lease); },
          prepareRelease: async () => { await checkpoint(); return releaseSchema.parse(await this.store.command("PREVIEW", lease)); },
          loadResults: async () => { const result = z.object({ runs: z.array(z.unknown()) }).parse(await this.store.command("RESULT", lease)); return result.runs.flatMap(r => { const loaded = loadReleaseEvidence(r as Parameters<typeof loadReleaseEvidence>[0]); return loaded ? [loaded] : []; }); } });
        const verdict = verifyResolution({ context, proposal, original, originalPlan: plan, fixSha: preview.identity().revision, ...result, now: new Date().toISOString() });
        await checkpoint();
        return { verdict };
      });
      if (outcome && typeof outcome === "object" && "verdict" in outcome) { const v = outcome.verdict as ReturnType<typeof verifyResolution>; return await this.store.command("COMPLETE", { ...lease, status: v.status, evidence: v.evidence, manifest: v.manifest }); }
      return outcome;
    } catch (error) {
      this.onError?.(error);
      const code = error instanceof Error ? error.message : "UNKNOWN";
      const status = code === "STALE" ? "STALE" : /PATCH_|FORBIDDEN|UNREGISTERED|SOURCE_PARSE/.test(code) ? "REJECTED" : "INCONCLUSIVE";
      await this.store.command("FAIL", { ...lease, status }); return { state: status };
    } finally { clearInterval(timer); await this.store.command("RELEASE", lease).catch(() => {}); }
  }
  async run(signal: AbortSignal) {
    while (!signal.aborted) {
      try { await this.tick(signal); } catch (error) { this.onError?.(error); }
      if (signal.aborted) break;
      await new Promise<void>(resolve => { const timer=setTimeout(done,1000); function done(){clearTimeout(timer);signal.removeEventListener("abort",done);resolve();}signal.addEventListener("abort",done,{once:true}); });
    }
  }
}
