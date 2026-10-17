import "server-only";

export type { ManagedSecretStore, SecretReference, CredentialLease } from "../../../services/production/secrets";
/** Legacy callback boundary retained for existing consumers. The Phase 10
 * ManagedSecretStore adds versioned references, rotation and scoped delivery.
 * A backend must authenticate the lease, enforce scope,
 * check current membership/org status and revocation, and audit use before resolving.
 * Do not return a lease or resolved bytes through a browser-facing API. */
export interface SecretLease {
  readonly organizationId: string;
  readonly projectId: string | null;
  readonly secretReferenceId: string;
  readonly purpose: "INTEGRATION" | "TEST_IDENTITY" | "SIGNING";
  readonly expiresAt: string;
  readonly authenticatedLease: Uint8Array;
}
export interface ManagedSecretBackend {
  withSecret<T>(lease: SecretLease, operation: (material: Uint8Array) => Promise<T>): Promise<T>;
  revoke(referenceId: string): Promise<void>;
}
