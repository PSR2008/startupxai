import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, randomUUID, createHmac } from "node:crypto";
import { GitHubProvider } from "../src/server/github/provider";
import { receiveWebhook } from "../src/server/github/webhook";
import { releaseEvent } from "../services/releases/webhook";
import { checkConclusion, checkOutput } from "../services/releases/checks";
import { evaluateRelease } from "../services/releases/engine";
import { releaseFixture } from "./fixtures/release";
const config = { appId: 123, clientId: "fixture", clientSecret: "fixture", privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(), webhookSecret: "synthetic-secret", redirectUri: "https://local.test/callback" };
for (const [decision, conclusion] of [["SHIP", "success"], ["BLOCK", "failure"], ["INCONCLUSIVE", "action_required"]] as const)
  test(`GitHub ${decision} maps to ${conclusion}`, () => assert.equal(checkConclusion(decision), conclusion));
test("GitHub incomplete assurance never uses a merge-approving conclusion", () => {
  const f = releaseFixture(); f.evidence = []; const output = checkOutput(evaluateRelease(f));
  assert.equal(output.title, "ASSURANCE INCOMPLETE"); assert.ok(!["success", "neutral", "skipped"].includes(output.conclusion));
});
test("check summary never includes payload, reasons, waiver text or model explanations", () => {
  const e = evaluateRelease(releaseFixture("vulnerable")); e.reasons.push("secret_token=private-payload"); e.coverage[0].reason = "customer_private_email"; e.findings.push({ id: "private-email@example.com", blocking: true, applicability: "EXACT" });
  assert.doesNotMatch(checkOutput(e).summary, /secret_token|private-payload|customer_private|example.com/);
});
test("check creation and same-SHA retry reconcile exact identity and narrowed write permission", async () => {
  const connection = randomUUID(), sha = "a".repeat(40); let posts = 0, patches = 0;
  const checks: Array<{id:number;head_sha:string;external_id:string;app:{id:number}}> = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    assert.equal(url.origin, "https://api.github.com"); assert.equal(init?.redirect, "error");
    if (url.pathname === "/app/installations/456") return Response.json({ id: 456, app_id: 123, account: { id: 1 }, suspended_at: null, permissions: { contents: "read", metadata: "read", checks: "write" } });
    if (url.pathname.endsWith("/access_tokens")) { assert.deepEqual(body, { repository_ids: [789], permissions: { checks: "write", metadata: "read" } }); return Response.json({ token: "synthetic-installation-token", expires_at: new Date(Date.now() + 3600000).toISOString() }); }
    if (url.pathname === "/repositories/789") return Response.json({ id: 789, owner: { login: "fixture" }, name: "sample", private: true, default_branch: "main" });
    if (init?.method === "GET") return Response.json({ total_count: checks.length, check_runs: checks });
    if (init?.method === "POST") { posts++; const check = { id: checks.length + 1, head_sha: body.head_sha, external_id: body.external_id, app: { id: 123 } }; checks.push(check); return Response.json(check); }
    patches++; assert.equal(body.head_sha, undefined); return Response.json(checks[0]);
  };
  const provider = new GitHubProvider(config, transport), args = { installationId: 456, repositoryId: 789, headSha: sha, externalId: `lg:${connection}:${sha}`, ...checkOutput(evaluateRelease(releaseFixture())) };
  let fences = 0; const checkpoint = async () => { fences++; };
  const first = await provider.publishCheck(args, checkpoint), retry = await provider.publishCheck(args, checkpoint);
  assert.equal(first.checkId, retry.checkId); assert.equal(posts, 1); assert.equal(patches, 1); assert.ok(fences >= 6);
  const next = "b".repeat(40); const newHead = await provider.publishCheck({ ...args, headSha: next, externalId: `lg:${connection}:${next}` }, checkpoint);
  assert.notEqual(newHead.checkId, first.checkId); assert.equal(newHead.headSha, next); assert.equal(posts, 2);
});
test("signed scheduling webhook forwards only exact numeric identities and SHA", async () => {
  const delivery = randomUUID(), input = { installation: { id: 456 }, repository: { id: 789 }, after: "a".repeat(40), before: "b".repeat(40), ref: "refs/heads/main", deleted: false, secret: "never-store-me" }, body = JSON.stringify(input);
  const received = new Map<string, unknown>();
  const request = () => new Request("https://local.test/webhook", { method: "POST", body, headers: { "x-github-event": "push", "x-github-delivery": delivery, "x-hub-signature-256": `sha256=${createHmac("sha256", config.webhookSecret).update(body).digest("hex")}` } });
  const releases = { async command(action: string, data: Record<string, unknown>) { assert.equal(action, "DELIVERY"); received.set(String(data.deliveryId), data); return {}; } };
  for (let i = 0; i < 2; i++) assert.equal((await receiveWebhook(request(), config, { async command() { throw new Error("wrong store"); } }, releases)).status, 200);
  assert.equal(received.size, 1); assert.doesNotMatch(JSON.stringify([...received.values()]), /never-store-me/);
});
test("cross-repository PR and deleted branch do not schedule a release", () => {
  assert.equal(releaseEvent("pull_request", { installation: { id: 1 }, repository: { id: 2 }, action: "opened", number: 3, pull_request: { head: { sha: "a".repeat(40), repo: { id: 4 } }, base: { sha: "b".repeat(40), repo: { id: 2 } } } }), null);
  assert.equal(releaseEvent("push", { installation: { id: 1 }, repository: { id: 2 }, after: "0".repeat(40), before: "a".repeat(40), deleted: true, ref: "refs/heads/main" }), null);
});
