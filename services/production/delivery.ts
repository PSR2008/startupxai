import { scopeKey, type SandboxProvider, type Scope, type OperationsStore } from "./contracts";
import { CredentialBroker, type SecretReference } from "./secrets";
import { boundedProviderCall } from "./operations";
/** Resolver is trusted server context, not browser-selected references. */
export function scopedCredentialDelivery(provider: SandboxProvider, broker: CredentialBroker, store: OperationsStore, resolve: (scope: Scope) => Promise<SecretReference | null>) {
  return async (scope: Scope, sandboxId: string, expiresAt: number) => {
    const reference = await resolve(scope); if (!reference) return;
    if(scopeKey(reference.scope)!==scopeKey(scope)||sandboxId!==scopeKey(scope))throw new Error("CREDENTIAL_SCOPE");
    const names = { TARGET_SESSION: "target-session", PREVIEW_BYPASS: "preview-bypass", TEST_PROVIDER: "test-provider" } as const;
    if (!(reference.purpose in names)) throw new Error("RUNNER_SECRET_DENIED");
    // Persist revocation intent before obtaining material. Destroying this scoped
    // reference is safe: references are dedicated to exactly one attempt.
    await store.command("REGISTER", { scope, kind: "CREDENTIAL", provider: "managed-secrets", externalId: reference.id, expiresAt: new Date(expiresAt).toISOString() });
    try{await broker.deliver({ scope, reference, expiresAt }, (bytes, expiry) => boundedProviderCall(()=>provider.injectScopedCredential(sandboxId, names[reference.purpose as keyof typeof names], bytes, expiry)));}
    catch{await Promise.allSettled([store.command("EXPIRE",{scope,kind:"CREDENTIAL"}),store.command("QUALIFY",{organizationId:scope.organizationId,environment:scope.environment,capability:"secrets.managed",status:"DEGRADED",live:false,evidenceDigest:null,expiresAt:new Date(Date.now()+300000).toISOString()})]);throw new Error("CREDENTIAL_UNAVAILABLE");}
  };
}
