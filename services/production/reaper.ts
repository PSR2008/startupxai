import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scopeSchema, type OperationsStore, type ResourceRecord } from "./contracts";
import type { ExecutionStore } from "../orchestrator/store";
import { boundedProviderCall } from "./operations";
const recordSchema = z.object({ id: z.string().uuid(), scope: scopeSchema, kind: z.enum(["SANDBOX", "CREDENTIAL", "ARTIFACT"]), provider: z.string(), externalId: z.string(), expiresAt: z.string(), fence: z.number().int().positive() });
/** Store persists claims/fences; a fresh process can reclaim after lease expiry. */
export class CleanupReaper {
  private workerId = randomUUID();
  constructor(private readonly store: OperationsStore, private readonly execution: ExecutionStore, private readonly cleanup: (record: ResourceRecord) => Promise<void>, private readonly environment: ResourceRecord["scope"]["environment"] = "test") {}
  async tick() {
    await this.execution.command("RECOVER", {}); // Existing dead jobs, budgets and fixture recovery.
    const value = await this.store.command("REAP_CLAIM", { workerId: this.workerId, environment: this.environment });
    if (!value) return false;
    const record = recordSchema.parse(value);
    if(record.scope.environment!==this.environment)throw new Error("REAPER_ENVIRONMENT_SCOPE");
    try { await boundedProviderCall(()=>this.cleanup(record),30000); await this.store.command("REAP_DONE", { id: record.id, fence: record.fence, workerId: this.workerId }); }
    catch { await this.store.command("REAP_FAILED", { id: record.id, fence: record.fence, workerId: this.workerId }); }
    return true;
  }
  async inventory() { return this.store.command("LEAKS", { environment: this.environment }); }
}
