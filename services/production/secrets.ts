import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { scopeKey, type Scope } from "./contracts";
export type SecretPurpose = "TARGET_SESSION" | "PREVIEW_BYPASS" | "TEST_PROVIDER" | "RUNNER_SIGNING" | "GITHUB_APP" | "WEBHOOK" | "ARTIFACT_SIGNING" | "PROVIDER";
export interface SecretReference { id: string; scope: Scope; purpose: SecretPurpose; version: number }
export interface CredentialLease { id: string; reference: SecretReference; audience: string; expiresAt: number }
export interface ManagedSecretStore {
  readonly kind: "managed" | "local-test";
  put(scope: Scope, purpose: SecretPurpose, material: Uint8Array): Promise<SecretReference>;
  lease(reference: SecretReference, audience: string, expiresAt: number): Promise<CredentialLease>;
  withLease<T>(lease: CredentialLease, scope: Scope, audience: string, operation: (material: Uint8Array) => Promise<T>): Promise<T>;
  rotate(reference: SecretReference, material: Uint8Array, overlapMs: number): Promise<SecretReference>;
  revoke(id: string): Promise<void>;
  delete(reference: SecretReference): Promise<void>;
}
/** Encrypted memory ONLY for contract tests. No managed backend or persistence claim. */
export class LocalTestSecretStore implements ManagedSecretStore {
  readonly kind = "local-test";
  private key = randomBytes(32);
  private values = new Map<string, { reference: SecretReference; bytes: Buffer; iv: Buffer; tag: Buffer; validUntil: number }>();
  private leases = new Map<string, CredentialLease>();
  constructor(private readonly now = Date.now) {}
  async put(scope: Scope, purpose: SecretPurpose, material: Uint8Array): Promise<SecretReference> {
    scopeKey(scope); if (!material.length || material.length > 16384) throw new Error("SECRET_SIZE");
    const reference = { id: randomUUID(), scope: structuredClone(scope), purpose, version: 1 };
    this.save(reference, material); return structuredClone(reference);
  }
  private save(reference: SecretReference, material: Uint8Array) {
    if (!material.length || material.length > 16384) throw new Error("SECRET_SIZE");
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(scopeKey(reference.scope)));
    this.values.set(`${reference.id}:${reference.version}`, { reference: structuredClone(reference), bytes: Buffer.concat([cipher.update(material), cipher.final()]), iv, tag: cipher.getAuthTag(), validUntil: Infinity });
  }
  private value(reference: SecretReference) {
    const v = this.values.get(`${reference.id}:${reference.version}`);
    if (!v || v.validUntil <= this.now() || scopeKey(v.reference.scope) !== scopeKey(reference.scope) || v.reference.purpose !== reference.purpose) throw new Error("SECRET_SCOPE"); return v;
  }
  async lease(reference: SecretReference, audience: string, expiresAt: number) {
    this.value(reference);
    if (audience !== `runner:${reference.scope.attemptId}` || !Number.isFinite(expiresAt) || expiresAt <= this.now() || expiresAt > this.now() + 900000) throw new Error("LEASE_SCOPE");
    const lease = { id: randomUUID(), reference: structuredClone(reference), audience, expiresAt }; this.leases.set(lease.id, lease); return structuredClone(lease);
  }
  async withLease<T>(lease: CredentialLease, scope: Scope, audience: string, operation: (material: Uint8Array) => Promise<T>): Promise<T> {
    const stored = this.leases.get(lease.id);
    if (!stored || JSON.stringify(stored) !== JSON.stringify(lease) || stored.expiresAt <= this.now() || stored.audience !== audience || scopeKey(stored.reference.scope) !== scopeKey(scope)) throw new Error("LEASE_DENIED");
    const v = this.value(stored.reference), cipher = createDecipheriv("aes-256-gcm", this.key, v.iv); cipher.setAAD(Buffer.from(scopeKey(scope))); cipher.setAuthTag(v.tag);
    const bytes = Buffer.concat([cipher.update(v.bytes), cipher.final()]);
    try { return await operation(bytes); } finally { bytes.fill(0); }
  }
  async rotate(reference: SecretReference, material: Uint8Array, overlapMs: number) {
    const old = this.value(reference); if (!Number.isFinite(overlapMs) || overlapMs < 0 || overlapMs > 900000) throw new Error("ROTATION_WINDOW");
    const next = { ...reference, version: reference.version + 1 };
    if (this.values.has(`${next.id}:${next.version}`)) throw new Error("ROTATION_CONFLICT");
    this.save(next, material); old.validUntil = this.now() + overlapMs; return structuredClone(next);
  }
  async revoke(id: string) { this.leases.delete(id); for(const [leaseId,lease] of this.leases)if(lease.reference.id===id)this.leases.delete(leaseId); for (const [key, value] of this.values) if (value.reference.id === id) { value.bytes.fill(0); this.values.delete(key); } }
  async delete(reference: SecretReference) { this.value(reference); await this.revoke(reference.id); }
  async expire() { for (const [id, lease] of this.leases) if (lease.expiresAt <= this.now()) this.leases.delete(id); for (const [id, v] of this.values) if (v.validUntil <= this.now()) { v.bytes.fill(0); this.values.delete(id); } }
  get activeLeases() { return this.leases.size; }
  dispose() { this.key.fill(0); for (const v of this.values.values()) v.bytes.fill(0); this.values.clear(); this.leases.clear(); }
}
export class CredentialBroker {
  constructor(private readonly store: ManagedSecretStore, private readonly authorize: (scope: Scope) => Promise<void>, private readonly now = Date.now) {}
  async deliver(input: { scope: Scope; reference: SecretReference; expiresAt: number }, inject: (material: Uint8Array, expiresAt: string) => Promise<void>) {
    if (scopeKey(input.scope) !== scopeKey(input.reference.scope) || !["TARGET_SESSION", "PREVIEW_BYPASS", "TEST_PROVIDER"].includes(input.reference.purpose)) throw new Error("RUNNER_SECRET_DENIED");
    await this.authorize(input.scope);
    const lease = await this.store.lease(input.reference, `runner:${input.scope.attemptId}`, Math.min(input.expiresAt, this.now() + 60000));
    try { await this.store.withLease(lease, input.scope, lease.audience, async bytes => { await this.authorize(input.scope); await inject(bytes, new Date(lease.expiresAt).toISOString()); }); }
    finally { await this.store.revoke(lease.id); }
  }
}
