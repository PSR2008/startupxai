import { z } from "zod";
import type { ArtifactStore } from "../orchestrator/artifacts";
import { digest } from "../runner/metadata";
import { scopeKey, type Scope, type OperationsStore } from "./contracts";
import { boundedProviderCall } from "./operations";
export interface PrivateObjectBackend {
  readonly kind: "managed" | "local-test";
  readonly private: true;
  readonly encryption: "PROVIDER_KMS";
  putIfAbsent(key: string, bytes: Uint8Array, metadata: { hash: string; expiresAt: string; scope: string }): Promise<{ hash: string }>;
  deletePrefix(prefix: string): Promise<void>;
  signedDownload(key: string, seconds: number): Promise<string>;
}
export class ProductionArtifacts implements ArtifactStore {
  constructor(private readonly backend: PrivateObjectBackend, private readonly scope: Scope, private readonly authorize: () => Promise<void>, private readonly now = Date.now, private readonly operations?:OperationsStore) { scopeKey(scope); if (backend.private !== true || backend.encryption !== "PROVIDER_KMS") throw new Error("ARTIFACT_BACKEND_UNSAFE"); }
  private prefix(attemptId: string) { if (attemptId !== this.scope.attemptId) throw new Error("ARTIFACT_SCOPE"); return `${scopeKey(this.scope)}/`; }
  async put(attemptId: string, id: string, bytes: Uint8Array, hash: string) {
    z.string().uuid().parse(id); const key = `${this.prefix(attemptId)}${id}`;
    if (bytes.length > 1048576 || digest(bytes) !== hash) throw new Error("ARTIFACT_HASH");
    await this.authorize(); const expiresAt=new Date(this.now()+7*86400000).toISOString();
    await this.operations?.command("REGISTER",{scope:this.scope,kind:"ARTIFACT",provider:"private-artifacts",externalId:scopeKey(this.scope),expiresAt});
    let result:{hash:string};
    try{result=await boundedProviderCall(()=>this.backend.putIfAbsent(key, bytes, { hash, scope: scopeKey(this.scope), expiresAt }));}
    catch{if(this.operations)await Promise.allSettled([this.operations.command("EXPIRE",{scope:this.scope,kind:"ARTIFACT"}),this.operations.command("QUALIFY",{organizationId:this.scope.organizationId,environment:this.scope.environment,capability:"artifacts.private",status:"DEGRADED",live:false,evidenceDigest:null,expiresAt:new Date(this.now()+300000).toISOString()})]);throw new Error("ARTIFACT_UNAVAILABLE");}
    if (result.hash !== hash) throw new Error("ARTIFACT_CONFLICT"); return key;
  }
  // Trusted cleanup remains possible after target authority is revoked. The
  // constructor's server-resolved scope and exact attempt key confine deletion.
  async removeAttempt(attemptId: string) { const prefix = this.prefix(attemptId); await boundedProviderCall(()=>this.backend.deletePrefix(prefix)); if(this.operations)await this.operations.command("DESTROYED",{scope:this.scope,kind:"ARTIFACT"}); }
  async download(id: string) { z.string().uuid().parse(id); await this.authorize(); const url = new URL(await this.backend.signedDownload(`${this.prefix(this.scope.attemptId)}${id}`, 60)); if (url.protocol !== "https:" || url.username || url.password) throw new Error("ARTIFACT_URL"); return url.href; }
}
