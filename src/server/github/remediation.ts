import "server-only";
import { z } from "zod";
import { createPrivateKey, createSign } from "node:crypto";
import { boundedBody } from "./provider";
import { sha, type RemediationContext, type Proposal } from "../../../services/remediation/contracts";
import { validateAutomaticPatch } from "../../../services/remediation/provider";
import { digest } from "../../../services/runner/metadata";

const id = z.number().int().positive().safe();
const segment = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
const branch = z.string().min(1).max(150).regex(/^[a-zA-Z0-9_/-]+$/).refine(v => !v.startsWith("/") && !v.endsWith("/") && !v.includes("//"));
export const capabilitySchema = z.object({ id: z.string().uuid(), organizationId: z.string().uuid(), projectId: z.string().uuid(), connectionId: z.string().uuid(), appId: id, installationId: id, repositoryId: id, enabled: z.literal(true), revokedAt: z.null(), expiresAt: z.string().datetime() }).strict();
export type WriteCapability = z.infer<typeof capabilitySchema>;
export function fixBranch(findingId: string, proposalId: string) { return `launchgate/fix/${z.string().uuid().parse(findingId)}-${z.string().uuid().parse(proposalId)}`; }
export function safePullBody(findingId: string, proposalId: string, paths: string[]) {
  return `FIX PROPOSED — VERIFICATION PENDING\n\nFinding: ${z.string().uuid().parse(findingId)}\nProposal: ${z.string().uuid().parse(proposalId)}\n\nProposes a bounded server-side enforcement change. Exact replay, positive controls and adjacent regressions are still required.\n\nFiles: ${paths.join(", ")}\n\nLaunchGate project link: pending.\n\nHuman review and merge required.`;
}
export function remediationConfiguration(env: Record<string, string | undefined> = process.env) {
  const appId = id.parse(Number(env.LAUNCHGATE_REMEDIATION_APP_ID)), privateKey = z.string().min(64).parse(env.LAUNCHGATE_REMEDIATION_PRIVATE_KEY?.replaceAll("\\n", "\n"));
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 || String(appId) === env.LAUNCHGATE_GITHUB_APP_ID) throw new Error("SEPARATE_REMEDIATION_APP_REQUIRED");
  return { appId, privateKey };
}
/** Called only after project ADMIN authorization and a database-derived repo ID.
 * It proves the separate installation can access that repo before enabling it. */
export async function verifyRemediationInstallation(config: { appId: number; privateKey: string }, installationId: number, repositoryId: number, transport: typeof fetch = fetch) {
  id.parse(installationId); id.parse(repositoryId);
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const claims = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: Math.floor(Date.now()/1000)-60, exp: Math.floor(Date.now()/1000)+480, iss: String(config.appId) })}`;
  const jwt = `${claims}.${createSign("RSA-SHA256").update(claims).sign(config.privateKey,"base64url")}`;
  const request = async (path: string, token: string, body?: unknown) => {
    const response = await transport(new URL(path,"https://api.github.com"), { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type":"application/json", "X-GitHub-Api-Version":"2022-11-28" }, ...(body ? {body:JSON.stringify(body)} : {}) });
    if (!response.ok) { await response.body?.cancel(); throw new Error("WRITE_PERMISSION_DENIED"); }
    return JSON.parse(Buffer.from(await boundedBody(response,1048576)).toString("utf8"));
  };
  const installation = z.object({ id, app_id:id, suspended_at:z.null(), permissions:z.record(z.string()) }).parse(await request(`/app/installations/${installationId}`,jwt));
  if (installation.id!==installationId || installation.app_id!==config.appId || installation.permissions.contents!=="write" || installation.permissions.pull_requests!=="write" || Object.entries(installation.permissions).some(([k,v]) => !["contents","pull_requests","metadata"].includes(k)||v!==(k==="metadata"?"read":"write"))) throw new Error("WRITE_PERMISSIONS");
  const access=z.object({token:z.string().min(10).max(4096),expires_at:z.string().datetime()}).parse(await request(`/app/installations/${installationId}/access_tokens`,jwt,{repository_ids:[repositoryId],permissions:{contents:"write",pull_requests:"write",metadata:"read"}}));
  if (Date.parse(access.expires_at)<=Date.now()||Date.parse(access.expires_at)>Date.now()+3700000) throw new Error("TOKEN_EXPIRY");
  const repo=z.object({id}).parse(await request(`/repositories/${repositoryId}`,access.token));
  if (repo.id!==repositoryId) throw new Error("REPOSITORY_SCOPE");
  return { appId:config.appId,installationId,repositoryId };
}
/** Optional separate App. Tokens exist only in this invocation, scoped to one
 * numeric repository. No update-ref, merge, deployment, secrets or workflow API. */
export class GitHubRemediationProvider {
  constructor(private readonly config: { appId: number; privateKey: string }, private readonly transport: typeof fetch = fetch) {}
  async createPullRequest(input: { capability: WriteCapability; context: RemediationContext; proposal: Proposal; baseBranch: string; requestedAt: string }, checkpoint: () => Promise<void>) {
    const c = capabilitySchema.parse(input.capability), ctx = input.context, p = input.proposal;
    const patch = validateAutomaticPatch(ctx, p, ctx.sourceSha), baseBranch = branch.parse(input.baseBranch), headBranch = fixBranch(ctx.findingId, p.id);
    z.string().datetime().parse(input.requestedAt);
    if (c.appId !== this.config.appId || c.organizationId !== ctx.organizationId || c.projectId !== ctx.projectId || c.connectionId !== ctx.connectionId || Date.parse(c.expiresAt) <= Date.now()) throw new Error("WRITE_CAPABILITY_DENIED");
    const signal = AbortSignal.timeout(60000);
    const request = async (path: string, token: string, body?: unknown, missing = false): Promise<unknown> => {
      await checkpoint(); if (Date.parse(c.expiresAt) <= Date.now()) throw new Error("WRITE_CAPABILITY_EXPIRED");
      const url = new URL(path, "https://api.github.com");
      if (url.origin !== "https://api.github.com" || !path.startsWith("/") || path.startsWith("//")) throw new Error("PROVIDER_ORIGIN");
      const r = await this.transport(url, { method: body === undefined ? "GET" : "POST", redirect: "error", signal, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (missing && r.status === 404) { await r.body?.cancel(); return null; }
      if (!r.ok) { await r.body?.cancel(); throw new Error("REMEDIATION_PROVIDER_DENIED"); }
      return JSON.parse(Buffer.from(await boundedBody(r, 1048576)).toString("utf8"));
    };
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const claims = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: Math.floor(Date.now() / 1000) - 60, exp: Math.floor(Date.now() / 1000) + 480, iss: String(this.config.appId) })}`;
    const jwt = `${claims}.${createSign("RSA-SHA256").update(claims).sign(this.config.privateKey, "base64url")}`;
    const installation = z.object({ id, app_id: id, suspended_at: z.null(), permissions: z.record(z.string()) }).parse(await request(`/app/installations/${c.installationId}`, jwt));
    if (installation.id !== c.installationId || installation.app_id !== c.appId || installation.permissions.contents !== "write" || installation.permissions.pull_requests !== "write" || Object.entries(installation.permissions).some(([k,v]) => !["contents", "pull_requests", "metadata"].includes(k) || v !== (k === "metadata" ? "read" : "write"))) throw new Error("WRITE_PERMISSIONS");
    const access = z.object({ token: z.string().min(10).max(4096), expires_at: z.string().datetime() }).parse(await request(`/app/installations/${c.installationId}/access_tokens`, jwt, { repository_ids: [c.repositoryId], permissions: { contents: "write", pull_requests: "write", metadata: "read" } }));
    if (Date.parse(access.expires_at) <= Date.now() || Date.parse(access.expires_at) > Date.now() + 3700000) throw new Error("TOKEN_EXPIRY");
    const repo = z.object({ id, owner: z.object({ login: segment }), name: segment }).parse(await request(`/repositories/${c.repositoryId}`, access.token));
    if (repo.id !== c.repositoryId) throw new Error("REPOSITORY_SCOPE");
    const base = `/repos/${repo.owner.login}/${repo.name}`, get = (path: string, missing = false) => request(base + path, access.token, undefined, missing), post = (path: string, body: unknown) => request(base + path, access.token, body);
    const assertHead = async () => { const ref = z.object({ object: z.object({ sha }) }).parse(await get(`/git/ref/heads/${baseBranch}`)); if (ref.object.sha !== ctx.sourceSha) throw new Error("STALE"); };
    await assertHead();
    const commit = z.object({ sha, tree: z.object({ sha }) }).parse(await get(`/git/commits/${ctx.sourceSha}`));
    if (commit.sha !== ctx.sourceSha) throw new Error("COMMIT_SCOPE");
    const originalTree = z.object({ sha, truncated: z.literal(false), tree: z.array(z.object({ path: z.string(), mode: z.string(), type: z.string(), sha })).max(2000) }).parse(await get(`/git/trees/${commit.tree.sha}?recursive=1`));
    if (originalTree.sha !== commit.tree.sha) throw new Error("TREE_SCOPE");
    for (const file of patch.files) {
      const entries = originalTree.tree.filter(e => e.path === file.path);
      if (entries.length !== 1 || entries[0].mode !== "100644" || entries[0].type !== "blob") throw new Error("SOURCE_MODE");
      const blob = z.object({ sha, encoding: z.literal("base64"), content: z.string().max(100000) }).parse(await get(`/git/blobs/${entries[0].sha}`));
      if (blob.sha !== entries[0].sha || digest(Buffer.from(blob.content.replace(/\s/g, ""), "base64").toString("utf8")) !== file.before) throw new Error("SOURCE_PROVENANCE");
    }
    const tree = z.object({ sha }).parse(await post("/git/trees", { base_tree: commit.tree.sha, tree: patch.files.map(f => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) }));
    const message = `fix: enforce registered server boundary\n\nFinding: ${ctx.findingId}\nProposal: ${p.id}`;
    const identity = { name: "LaunchGate automation", email: "automation@launchgate.invalid", date: input.requestedAt };
    const fixed = z.object({ sha, tree: z.object({ sha }), parents: z.array(z.object({ sha })).length(1) }).parse(await post("/git/commits", { message, tree: tree.sha, parents: [ctx.sourceSha], author: identity, committer: identity }));
    if (fixed.parents[0].sha !== ctx.sourceSha || fixed.tree.sha !== tree.sha || fixed.sha === ctx.sourceSha) throw new Error("FIX_COMMIT_SCOPE");
    await assertHead();
    const existing = await get(`/git/ref/heads/${headBranch}`, true);
    if (existing) { if (z.object({ object: z.object({ sha }) }).parse(existing).object.sha !== fixed.sha) throw new Error("BRANCH_COLLISION"); }
    else { const created = z.object({ ref: z.string(), object: z.object({ sha }) }).parse(await post("/git/refs", { ref: `refs/heads/${headBranch}`, sha: fixed.sha })); if (created.ref !== `refs/heads/${headBranch}` || created.object.sha !== fixed.sha) throw new Error("BRANCH_SCOPE"); }
    const prSchema = z.object({ number: id, body: z.string().nullable(), head: z.object({ sha, ref: z.string(), repo: z.object({ id }) }), base: z.object({ ref: z.string(), repo: z.object({ id }) }) });
    const list = z.array(prSchema).max(99).parse(await get(`/pulls?state=all&head=${encodeURIComponent(`${repo.owner.login}:${headBranch}`)}&base=${encodeURIComponent(baseBranch)}&per_page=100`));
    if (list.length > 1) throw new Error("AMBIGUOUS_PR");
    await assertHead();
    const pr = list[0] ?? prSchema.parse(await post("/pulls", { title: "fix: enforce registered server boundary", head: headBranch, base: baseBranch, draft: true, body: safePullBody(ctx.findingId, p.id, patch.files.map(f => f.path)) }));
    if (pr.head.sha !== fixed.sha || pr.head.ref !== headBranch || pr.base.ref !== baseBranch || pr.head.repo.id !== c.repositoryId || pr.base.repo.id !== c.repositoryId || !pr.body?.includes(`Proposal: ${p.id}`)) throw new Error("PR_SCOPE");
    return { number: pr.number, branch: headBranch, fixSha: fixed.sha, repositoryId: c.repositoryId, patchHash: patch.patchHash };
  }
}
