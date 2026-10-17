import { z } from "zod";
export const eventNames = ["RUN_CREATED", "QUEUE_DELAY", "SANDBOX_PROVISIONING", "SANDBOX_STARTED", "SANDBOX_TERMINATED", "SANDBOX_DESTROYED", "SANDBOX_LEAK", "TARGET_REQUEST", "BUDGET_DENIED", "CREDENTIAL_LEASED", "CREDENTIAL_REVOKED", "EVIDENCE_INGESTED", "ARTIFACT_UPLOAD", "PROVIDER_RETRY", "GITHUB_ERROR", "VERCEL_ERROR", "DATABASE_FAILURE", "CLEANUP_FAILURE", "DEAD_LETTER", "INTEGRATION_CONNECTED", "INTEGRATION_VERIFIED", "INTEGRATION_DEGRADED", "INTEGRATION_REVOKED", "READINESS_CHANGED"] as const;
const eventSchema = z.object({ event: z.enum(eventNames), correlationId: z.string().uuid(), organizationId: z.string().uuid().optional(), attemptId: z.string().uuid().optional(), durationMs: z.number().nonnegative().max(86400000).optional(), count: z.number().int().nonnegative().max(1000000).optional(), outcome: z.enum(["OK", "DENIED", "UNAVAILABLE", "INCONCLUSIVE"]).optional() }).strict();
export type OperationEvent = z.infer<typeof eventSchema>;
export class Observer {
  constructor(private readonly sink: (event: OperationEvent) => Promise<void>) {}
  emit(event: OperationEvent) { return this.sink(eventSchema.parse(event)); }
}
export type FailureCode = "TIMEOUT" | "NETWORK" | "RATE_LIMIT" | "SERVER" | "CREDENTIAL" | "REVOKED" | "TARGET" | "POLICY" | "MALFORMED";
export class ProviderFailure extends Error { constructor(readonly code: FailureCode, readonly retryAfterMs = 0) { super(code); } }
export async function boundedProviderCall<T>(operation:()=>Promise<T>,milliseconds=10000):Promise<T>{
  if(!Number.isFinite(milliseconds)||milliseconds<1||milliseconds>30000)throw new ProviderFailure("POLICY");
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ProviderFailure("TIMEOUT")),milliseconds);})]);}
  finally{if(timer)clearTimeout(timer);}
}
/** Retry only reads or operations whose provider guarantees reconciliation by key. */
export class ProviderCircuit {
  private failures = 0; private openUntil = 0;
  constructor(private readonly now = Date.now, private readonly sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {}
  get degraded() { return this.openUntil > this.now(); }
  async execute<T>(operation: () => Promise<T>, options: { idempotent: boolean; onRetry?: () => Promise<void>; timeoutMs?:number }): Promise<T> {
    if (this.degraded) throw new ProviderFailure("SERVER");
    for (let attempt = 0; ; attempt++) {
      try { const result = await boundedProviderCall(operation,options.timeoutMs); this.failures = 0; this.openUntil = 0; return result; }
      catch (error) {
        this.failures++; if (this.failures >= 3) this.openUntil = this.now() + 30000;
        const retry = error instanceof ProviderFailure && ["TIMEOUT", "NETWORK", "RATE_LIMIT", "SERVER"].includes(error.code);
        if (!retry || !options.idempotent || attempt >= 2 || this.degraded) throw new ProviderFailure(error instanceof ProviderFailure ? error.code : "MALFORMED");
        await options.onRetry?.(); await this.sleep(Math.min(5000, Math.max(100 * 2 ** attempt, error.retryAfterMs)));
      }
    }
  }
}
