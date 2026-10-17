import { isolationPolicy, type ResourceRecord, type SandboxProvider, type OperationsStore } from "./contracts";
import { boundedProviderCall } from "./operations";
/** Host polling complements provider-enforced hard ceilings; it is not OS isolation. */
export class SandboxSupervisor {
  constructor(private readonly provider: SandboxProvider, private readonly store: OperationsStore, private readonly authorize: (record: ResourceRecord) => Promise<void>, private readonly now = Date.now) {}
  async check(record: ResourceRecord) {
    if (record.kind !== "SANDBOX" || record.provider !== this.provider.name) throw new Error("SUPERVISOR_SCOPE");
    try {
      await this.authorize(record);
      if (!(Date.parse(record.expiresAt) > this.now())) throw new Error("DEADLINE");
      const [heartbeat, usage] = await boundedProviderCall(()=>Promise.all([this.provider.heartbeat(record.externalId), this.provider.getUsage(record.externalId)]));
      if (!heartbeat.alive || !Object.values(usage).every(n=>Number.isFinite(n)&&n>=0) || usage.memoryBytes > isolationPolicy.memoryBytes || usage.diskBytes > isolationPolicy.diskBytes || usage.cpuMillis > isolationPolicy.maxSeconds * 1000) throw new Error("RUNNER_LOST_OR_BUDGET");
      return "ACTIVE" as const;
    } catch {
      await this.store.command("EXPIRE", { scope: record.scope, kind: "SANDBOX" });
      // Do not mark cleaned if either call fails; the durable reaper retries.
      await boundedProviderCall(()=>this.provider.terminate(record.externalId)); await boundedProviderCall(()=>this.provider.destroy(record.externalId));
      await this.store.command("DESTROYED", { scope: record.scope, kind: "SANDBOX" });
      return "INCONCLUSIVE" as const;
    }
  }
}
