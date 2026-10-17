import type { KeyObject } from "node:crypto";
import { signGrant, verifyGrant } from "../runner/grant";
import type { ExecutionGrant } from "@launchgate/contracts";
/** Trusted control-plane key set. kid is authenticated as part of the signed grant envelope selection. */
export class RunnerKeyRing {
  private keys = new Map<string, { publicKey: KeyObject; privateKey?: KeyObject; until: number }>();
  private active?: string;
  constructor(private readonly now = Date.now) {}
  rotate(id: string, pair: { publicKey: KeyObject; privateKey: KeyObject }, overlapMs: number) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || this.keys.has(id) || pair.publicKey.asymmetricKeyType !== "ed25519" || pair.privateKey.asymmetricKeyType !== "ed25519" || !Number.isFinite(overlapMs) || overlapMs < 0 || overlapMs > 900000) throw new Error("KEY_ROTATION");
    if (this.active) { const old = this.keys.get(this.active)!; old.until = this.now() + overlapMs; old.privateKey = undefined; }
    this.keys.set(id, { ...pair, until: Infinity }); this.active = id;
  }
  revoke(id: string) { this.keys.delete(id); if (this.active === id) this.active = undefined; }
  sign(grant: ExecutionGrant) { const key = this.active ? this.keys.get(this.active) : undefined; if (!key?.privateKey) throw new Error("NO_SIGNING_KEY"); return `${this.active}:${signGrant(grant, key.privateKey)}`; }
  verify(token: string) { const split = token.indexOf(":"), id = token.slice(0, split), key = this.keys.get(id); if (split < 1 || !key || key.until <= this.now()) throw new Error("KEY_REVOKED"); return verifyGrant(token.slice(split + 1), key.publicKey, this.now()); }
}
