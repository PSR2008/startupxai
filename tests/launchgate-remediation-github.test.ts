import { architectureDigest } from "../services/remediation/architecture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { GitHubRemediationProvider, verifyRemediationInstallation, fixBranch, type WriteCapability } from "../src/server/github/remediation";
import { DeterministicRemediationProvider, generateProposal, templateSource } from "../services/remediation/provider";
import { digest } from "../services/runner/metadata";
import type { RemediationContext } from "../services/remediation/contracts";
import { readFileSync } from "node:fs";

async function fixture(fault = "") {
  const file = templateSource("tenant.read").file, keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const c: RemediationContext = { organizationId: randomUUID(), projectId: randomUUID(), findingId: randomUUID(), invariantId: randomUUID(), invariantVersion: 1, sourceSha: "a".repeat(40), deploymentId: randomUUID(), connectionId: randomUUID(), planHash: digest("plan"), originalManifest: digest("manifest"), reproduced: true, files: [file], allowedPaths: [file.path], provenance: "REGISTERED_REFERENCE_LAB", caseId: "tenant.read", architectureDigest: architectureDigest([file]) };
  const proposal = await generateProposal(new DeterministicRemediationProvider(), c);
  const capability: WriteCapability = { id: randomUUID(), organizationId: c.organizationId, projectId: c.projectId, connectionId: c.connectionId!, appId: 10, installationId: 20, repositoryId: 30, enabled: true, revokedAt: null, expiresAt: new Date(Date.now() + 300000).toISOString() };
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> | undefined }> = [];
  let existing = false, pull: unknown = null;
  const fixSha = "b".repeat(40), treeSha = "c".repeat(40), blobSha = "d".repeat(40), newTree = "e".repeat(40), head = fixBranch(c.findingId, proposal.id);
  const transport: typeof fetch = async (url, options) => {
    const u = new URL(String(url)), path = u.pathname + u.search, method = options?.method ?? "GET", body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ path, method, body }); assert.equal(u.origin, "https://api.github.com"); assert.equal(options?.redirect, "error");
    let result: unknown;
    if (path === "/app/installations/20") result = { id: 20, app_id: 10, suspended_at: null, permissions: { contents: fault === "read-only" ? "read" : "write", pull_requests: "write", metadata: "read", ...(fault === "workflow" ? { workflows: "write" } : {}) } };
    else if (path.endsWith("/access_tokens")) result = { token: "synthetic-private-token", expires_at: new Date(Date.now() + 300000).toISOString() };
    else if (path === "/repositories/30") result = { id: fault === "repository" ? 31 : 30, owner: { login: "fixture" }, name: "repository" };
    else if (path.endsWith("/git/ref/heads/main")) result = { object: { sha: fault === "stale" ? "f".repeat(40) : c.sourceSha } };
    else if (path.endsWith(`/git/commits/${c.sourceSha}`)) result = { sha: c.sourceSha, tree: { sha: treeSha } };
    else if (path.includes("/git/trees/") && method === "GET") result = { sha: treeSha, truncated: false, tree: [{ path: file.path, mode: fault === "symlink" ? "120000" : "100644", type: "blob", sha: blobSha }] };
    else if (path.includes("/git/blobs/")) result = { sha: blobSha, encoding: "base64", content: Buffer.from(fault === "source" ? "changed" : file.content).toString("base64") };
    else if (path.endsWith("/git/trees")) result = { sha: newTree };
    else if (path.endsWith("/git/commits")) result = { sha: fixSha, tree: { sha: newTree }, parents: [{ sha: c.sourceSha }] };
    else if (path.endsWith(`/git/ref/heads/${head}`)) { if (!existing && fault !== "collision") return new Response(null, { status: 404 }); result = { object: { sha: fault === "collision" ? "f".repeat(40) : fixSha } }; }
    else if (path.endsWith("/git/refs")) { existing = true; result = { ref: `refs/heads/${head}`, object: { sha: fixSha } }; }
    else if (path.includes("/pulls?") && method === "GET") result = pull ? [pull] : [];
    else if (path.endsWith("/pulls") && method === "POST") { pull = { number: 7, body: body.body, head: { sha: fixSha, ref: head, repo: { id: 30 } }, base: { ref: "main", repo: { id: 30 } } }; result = pull; }
    else throw new Error(`Unexpected contract endpoint ${path}`);
    return Response.json(result);
  };
  const config = { appId: 10, privateKey: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
  const provider = new GitHubRemediationProvider(config, transport);
  return { provider, calls, config, transport, input: { capability, context: c, proposal, baseBranch: "main", requestedAt: "2026-10-15T00:00:00.000Z" } };
}
test("optional write app creates exact-parent draft PR and reconciles retries", async () => {
  const f = await fixture(); const result = await f.provider.createPullRequest(f.input, async () => {});
  assert.equal(result.number, 7); assert.deepEqual(await f.provider.createPullRequest(f.input, async () => {}), result);
  assert.equal(f.calls.filter(c => c.path.endsWith("/pulls") && c.method === "POST").length, 1);
  assert.equal(f.calls.filter(c => c.path.endsWith("/git/refs") && c.method === "POST").length, 1);
  assert.deepEqual(f.calls.find(c => c.path.endsWith("/access_tokens"))?.body, { repository_ids: [30], permissions: { contents: "write", pull_requests: "write", metadata: "read" } });
  assert.ok(f.calls.every(c => c.method !== "PATCH" && c.method !== "PUT" && !c.path.includes("/merge")));
  assert.ok(!JSON.stringify(result).includes("synthetic-private-token"));
  const body = f.calls.find(c => c.path.endsWith("/pulls") && c.method === "POST")!.body!;
  assert.equal(body.draft, true); assert.match(String(body.body), /VERIFICATION PENDING/); assert.ok(!String(body.body).includes("PRIVATE_B"));
});
for (const fault of ["read-only", "workflow", "repository", "stale", "symlink", "source", "collision"]) test(`GitHub remediation refuses ${fault}`, async () => {
  const f = await fixture(fault); await assert.rejects(f.provider.createPullRequest(f.input, async () => {}));
  assert.ok(!f.calls.some(c => c.path.endsWith("/pulls") && c.method === "POST"));
});
test("revoked capability, foreign project and absent consent stop writes", async () => {
  const f = await fixture();
  await assert.rejects(f.provider.createPullRequest({ ...f.input, capability: { ...f.input.capability, projectId: randomUUID() } }, async () => {}));
  await assert.rejects(f.provider.createPullRequest(f.input, async () => { throw new Error("CONSENT_REVOKED"); }));
  assert.equal(f.calls.length, 0);
});
test("branch names accept only scoped IDs and cannot select main", () => {
  assert.throws(() => fixBranch("../../main", randomUUID()));
  assert.match(fixBranch(randomUUID(), randomUUID()), /^launchgate\/fix\//);
});
test("default analysis integration remains read-only for repository contents", () => {
  const source = readFileSync(new URL("../src/server/github/provider.ts", import.meta.url), "utf8");
  assert.ok(!source.includes('contents:"write"')); assert.ok(source.includes('permissions:{contents:"read",metadata:"read"}'));
});
test("explicit capability verification returns scoped metadata without persisting token", async () => {
  const f = await fixture(); const verified = await verifyRemediationInstallation(f.config, 20, 30, f.transport);
  assert.deepEqual(verified, { appId:10, installationId:20, repositoryId:30 });
  assert.ok(f.calls.every(c => !c.path.endsWith("/pulls") && !c.path.includes("/git/")));
});
for (const fault of ["repository", "workflow", "read-only"]) test(`capability activation refuses ${fault}`, async () => {
  const f=await fixture(fault);await assert.rejects(verifyRemediationInstallation(f.config,20,30,f.transport));
});
