import { scopeKey, type SandboxProvider, type ResourceRecord } from "./contracts";
import type { ManagedSecretStore } from "./secrets";
import type { PrivateObjectBackend } from "./artifacts";
export function resourceCleaner(environment: ResourceRecord["scope"]["environment"], sandbox: SandboxProvider, secrets: ManagedSecretStore, artifacts: PrivateObjectBackend) {
  return async (record: ResourceRecord) => {
    if (record.scope.environment !== environment) throw new Error("CLEANUP_ENVIRONMENT");
    if (record.kind === "SANDBOX") {
      if (record.provider !== sandbox.name || record.externalId !== scopeKey(record.scope)) throw new Error("CLEANUP_OWNERSHIP");
      await sandbox.terminate(record.externalId); await sandbox.destroy(record.externalId);
    } else if (record.kind === "CREDENTIAL") {
      if (record.provider !== "managed-secrets" || !/^[a-f0-9-]{36}$/.test(record.externalId)) throw new Error("CLEANUP_OWNERSHIP");
      await secrets.revoke(record.externalId);
    } else {
      if (record.provider !== "private-artifacts" || record.externalId !== scopeKey(record.scope)) throw new Error("CLEANUP_OWNERSHIP");
      await artifacts.deletePrefix(`${scopeKey(record.scope)}/`);
    }
  };
}
