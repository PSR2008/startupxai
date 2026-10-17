import { z } from "zod";
import type { RunnerProvider } from "../orchestrator/orchestrator";
import { scopeKey, scopeSchema, isolationPolicy, type Scope, type SandboxProvider, type OperationsStore, type GrantAuthority } from "./contracts";
import { egressPolicy, policyDigest, validateAttestation } from "./policy";
import { ProviderCircuit, Observer, boundedProviderCall } from "./operations";
import { productionConfigSchema, readiness, type Qualification } from "./readiness";
/** Trusted adapter host: no DB client, provider key or ambient env is copied into a sandbox. */
export class ProductionSandboxRunner implements RunnerProvider {
  constructor(private readonly provider: SandboxProvider, private readonly store: OperationsStore, private readonly grants: GrantAuthority,
    private readonly environment: "staging" | "production", private readonly authorize: (scope: Scope) => Promise<void>, private readonly observer: Observer, private readonly circuit = new ProviderCircuit(),
    private readonly deliverCredentials?: (scope: Scope, sandboxId: string, expiresAt: number) => Promise<void>) {
    if (provider.kind !== "production") throw new Error("LOCAL_PROVIDER_IN_PRODUCTION");
  }
  async launch(input: { attemptId: string; runnerId: string; grant: string; deadline: string }) {
    const g = this.grants.verify(input.grant);
    if (g.attemptId !== input.attemptId || g.runner.identity !== input.runnerId || Date.parse(input.deadline) !== g.exp * 1000 || !g.runner.imageDigest) throw new Error("RUNNER_BINDING");
    const scope: Scope = { environment: this.environment, organizationId: g.organizationId, runId: g.runId, attemptId: g.attemptId };
    const id = scopeKey(scope), egress = egressPolicy(g); await this.authorize(scope);
    // Persist intent BEFORE external creation. Provider must reconcile the same key,
    // including destroy(key) if a crash happens before create returns.
    await this.store.command("REGISTER", { scope, kind: "SANDBOX", provider: this.provider.name, externalId: id, expiresAt: input.deadline });
    try {
      await this.observer.emit({ event: "SANDBOX_PROVISIONING", correlationId: g.jti, organizationId: g.organizationId, attemptId: g.attemptId });
      const retryOptions={idempotent:true,onRetry:()=>this.observer.emit({event:"PROVIDER_RETRY",correlationId:g.jti,attemptId:g.attemptId,count:1,outcome:"UNAVAILABLE"})};
      const sandbox = await this.circuit.execute(() => this.provider.createSandbox({ scope, idempotencyKey: id, imageDigest: g.runner.imageDigest!, deadline: input.deadline, isolation: isolationPolicy }), retryOptions);
      if (sandbox.id !== id) throw new Error("SANDBOX_IDENTITY");
      await boundedProviderCall(()=>this.provider.configureEgressPolicy(id, egress));
      validateAttestation(await boundedProviderCall(()=>this.provider.getAttestationMetadata(id)), { scope, sandboxId: id, imageDigest: g.runner.imageDigest, policyDigest: policyDigest(egress), provider: this.provider.name });
      await this.authorize(scope); this.grants.verify(input.grant);
      const material = Buffer.from(input.grant);
      try { await boundedProviderCall(()=>this.provider.injectScopedCredential(id, "execution-grant", material, input.deadline)); } finally { material.fill(0); }
      await this.deliverCredentials?.(scope,id,g.exp*1000);
      await this.authorize(scope); this.grants.verify(input.grant);
      await this.circuit.execute(() => this.provider.startExecution(id, "launchgate-controlled-verification", id), retryOptions);
      await this.observer.emit({ event: "SANDBOX_STARTED", correlationId: g.jti, attemptId: g.attemptId });
    } catch {
      await Promise.allSettled([this.store.command("EXPIRE", { scope, kind: "SANDBOX" }),this.store.command("QUALIFY",{organizationId:scope.organizationId,environment:scope.environment,capability:"sandbox.production",status:"DEGRADED",live:false,evidenceDigest:null,expiresAt:new Date(Date.now()+300000).toISOString()})]);
      throw new Error("SANDBOX_INCONCLUSIVE");
    }
  }
  private async owned(attemptId: string) { return z.array(z.object({ externalId: z.string(), provider: z.string(), scope: scopeSchema })).parse(await this.store.command("ATTEMPT", { attemptId, environment: this.environment })).map(r => { if(r.provider !== this.provider.name || r.scope.attemptId !== attemptId || r.scope.environment !== this.environment || r.externalId!==scopeKey(r.scope)) throw new Error("SANDBOX_OWNERSHIP"); return r; }); }
  async terminate(attemptId: string) { for (const r of await this.owned(attemptId)) await boundedProviderCall(()=>this.provider.terminate(r.externalId)); }
  async cleanup(attemptId: string) { for (const r of await this.owned(attemptId)) { await boundedProviderCall(()=>this.provider.terminate(r.externalId)); await boundedProviderCall(()=>this.provider.destroy(r.externalId)); await this.store.command("DESTROYED", { scope: r.scope, kind: "SANDBOX" }); } }
}
export function productionRunner(input: { config: unknown; qualifications: Qualification[]; provider: SandboxProvider; store: OperationsStore; grants: GrantAuthority; authorize: (scope: Scope) => Promise<void>; observer: Observer }) {
  const c = productionConfigSchema.parse(input.config), ready = readiness(c, input.qualifications);
  if (!ready.productionReady || !["staging", "production"].includes(c.environment) || input.provider.kind !== "production") throw new Error("PRODUCTION_NOT_QUALIFIED");
  return new ProductionSandboxRunner(input.provider, input.store, input.grants, c.environment as "staging" | "production", input.authorize, input.observer);
}
