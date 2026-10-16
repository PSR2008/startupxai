import type { KeyObject } from "node:crypto";
import { LocalLabProvider } from "../../reference-lab/host";
import { planHash, validatePlan, type TestPlan } from "../../reference-lab/plans";
import { Orchestrator } from "../orchestrator/orchestrator";
import type { ExecutionStore } from "../orchestrator/store";
import type { ArtifactStore } from "../orchestrator/artifacts";
import { ReleaseWorker, type ReleaseStore } from "../releases/worker";
import type { VerificationDriverInput, VerificationDriverResult } from "./worker";
import { rejectAllBusinessOperations } from "./bad-fix-fixture";

/** Operator-owned catalog only. Full Phase 8 policy is executed; the originating
 * invariant is registered as an exact replay, never replaced by a new oracle. */
export function registeredLabDriver(options: { execution: ExecutionStore; releases: ReleaseStore; artifacts: ArtifactStore; privateKey: KeyObject; publicKey: KeyObject;
  plans: ReadonlyMap<string, TestPlan>; badFix?: boolean }) {
  return async (input: VerificationDriverInput): Promise<VerificationDriverResult> => {
    const release = await input.prepareRelease();
    const registry = new Map<string, { plan: TestPlan; variant: "vulnerable" | "fixed"; findingId?: string }>();
    for (const req of input.policy.requirements) {
      const p = req.invariant.id === input.plan.spec.id ? input.plan : options.plans.get(req.invariant.id);
      if (!p) continue; // Missing adapters remain explicit NOT_RUN in Phase 8.
      const plan = validatePlan(p);
      if (planHash(plan) !== req.planHash) throw new Error("REGRESSION_PLAN_CHANGED");
      const sameFamily = input.preview.startFixture ? !plan.billing && !plan.ai && !plan.journey : input.preview.startBillingFixture ? !!plan.billing : !!plan.ai;
      // Unrelated domains retain their fixed lab baseline; affected code is run
      // in vulnerable mode so the actual patch must enforce the boundary.
      registry.set(req.invariant.id, { plan, variant: sameFamily ? "vulnerable" : "fixed", ...(req.invariant.id === input.plan.spec.id ? { findingId: input.context.findingId } : {}) });
    }
    const execution: ExecutionStore = { async command(action,data) { if(action==="CHECK") await input.checkpoint(); return options.execution.command(action,["CLAIM","CLEANUP_CLAIM","RECOVER"].includes(action)?{...data,remediationReleaseId:release.id}:data); } };
    const preview=options.badFix&&input.preview.startFixture?{...input.preview,startFixture:async(...args:Parameters<NonNullable<typeof input.preview.startFixture>>)=>rejectAllBusinessOperations(await input.preview.startFixture!(...args))}:input.preview;
    const provider = new LocalLabProvider(options.publicKey, execution, options.artifacts, { preview, ...(options.badFix ? { billingFault: "REJECT_ALL" as const, aiFault: "REJECT_ALL" as const } : {}) });
    const orchestrator = new Orchestrator(execution, provider, options.privateKey, options.artifacts);
    const releases = new ReleaseWorker({command:(action,data)=>options.releases.command(action,action==="CLAIM"?{...data,remediationReleaseId:release.id}:data)}, { lab: { identity: input.preview.identity, plans: registry } });
    let completed=false;
    try {
      const deadline = Date.now() + 600000;
      for (let n = 0; n < input.policy.requirements.length * 3 + 10; n++) {
        if (Date.now() > deadline) throw new Error("VERIFICATION_DEADLINE");
        await input.checkpoint(); const result = await releases.tick();
        if (result?.releaseId === release.id) { const evidence=await input.loadResults();completed=true;return { release, policy: input.policy, evidence }; }
        await orchestrator.tick(); await provider.drain();
      }
      throw new Error("VERIFICATION_INCOMPLETE");
    } finally {
      if(!completed){
        await input.abandon();
        // Existing RECOVER/CLEANUP commands confirm termination and release the
        // reserved budget before the temporary preview workspace is destroyed.
        for(let n=0;n<input.policy.requirements.length+1;n++)await orchestrator.tick();
      }
      for (const result of provider.results.values()) { await provider.terminate(result.bundle.attemptId); await provider.cleanup(result.bundle.attemptId); }
    }
  };
}
