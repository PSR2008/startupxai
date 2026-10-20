import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { qualificationChecks, qualificationNames, qualify, configurationDigest, stagingManifestSchema, launchPolicy, type StagingManifest, type QualificationDriver } from "../services/production/qualification";
import { configurationInventory, runtimeConfigurationDigest } from "../src/server/production/inventory";
import { qualificationReader } from "../src/server/production/store";
import { capabilityRegistry } from "../services/production/readiness";

const manifest = (): StagingManifest => ({
  schemaVersion: 1, environment: "staging", dedicated: true, organizationId: randomUUID(), projectId: randomUUID(),
  stagingOrigin: "https://launchgate-staging-fixture.vercel.app", supabaseOrigin: "https://dedicated-test.supabase.co",
  repositoryId: 123, repository: "fixture/launchgate-test", vercelProjectId: "prj_fixture",
  artifactNamespace: "launchgate-staging-artifacts", secretNamespace: "launchgate-staging-secrets",
  configurationRevision: randomUUID(), credentialRevision: randomUUID(), permissionRevision: randomUUID(), sandboxVersion: "fixture-v1",
  approvedCapabilities: [...qualificationNames], allowTestPullRequest: false, paymentMode: "TEST_ONLY",
});
function contract(capability: keyof typeof qualificationChecks, changes: object = {}): QualificationDriver {
  return { kind: "contract", async exercise(m) { return { environment: "staging", organizationId: m.organizationId, projectId: m.projectId, configurationDigest: configurationDigest(m), live: false, evidenceDigest: `sha256:${"a".repeat(64)}`, checks: Object.fromEntries(qualificationChecks[capability].map(c => [c, "PASS" as const])), cleanupComplete: true, ...changes }; }, async cleanup() { return true; } };
}
test("inventory exposes only classifications, including live-payment refusal", () => {
  const raw = { OPENAI_API_KEY: "sk-" + "secret".repeat(8), ANTHROPIC_API_KEY: "placeholder", STRIPE_SECRET_KEY: "sk_live_unsafe", RAZORPAY_KEY_ID: "rzp_live_unsafe", LAUNCHGATE_GITHUB_PRIVATE_KEY: "malformed-secret" };
  const result = configurationInventory(raw);
  assert.equal(result.OPENAI_API_KEY, "CONFIGURED"); assert.equal(result.ANTHROPIC_API_KEY, "PLACEHOLDER");
  assert.equal(result.STRIPE_SECRET_KEY, "MALFORMED"); assert.equal(result.RAZORPAY_KEY_ID, "MALFORMED");
  for (const secret of Object.values(raw)) assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(result.LAUNCHGATE_GITHUB_PRIVATE_KEY, "MALFORMED");
});
for (const capability of qualificationNames) test(`${capability}: absent dedicated assets never invoke a driver`, async () => {
  const driver: QualificationDriver = { kind: "live", async exercise() { throw new Error("MUST_NOT_CALL"); }, async cleanup() { throw new Error("MUST_NOT_CALL"); } };
  const result = await qualify(capability, undefined, driver);
  assert.equal(result.status, capability === "github.remediation.live" ? "UNVERIFIED" : "BLOCKED_BY_ENVIRONMENT"); assert.equal(result.live, false); assert.equal(result.evidenceDigest, null);
});
test("staging manifest rejects production, secrets, arbitrary hosts and live payments", () => {
  for (const change of [{ environment: "production" }, { dedicated: false }, { token: "secret" }, { stagingOrigin: "http://127.0.0.1" }, { stagingOrigin: "invalid-url" }, { supabaseOrigin: "invalid-url" }, { supabaseOrigin: "https://unrelated.example.net" }, { paymentMode: "LIVE" }]) assert.equal(stagingManifestSchema.safeParse({ ...manifest(), ...change }).success, false);
});
test("configuration, credential, permission and sandbox changes alter evidence identity", () => {
  const m = manifest(), first = configurationDigest(m);
  for (const change of [{ credentialRevision: randomUUID() }, { permissionRevision: randomUUID() }, { configurationRevision: randomUUID() }, { sandboxVersion: "next" }, { repositoryId: 456 }]) assert.notEqual(configurationDigest({ ...m, ...change }), first);
});
test("configured asset without registered adapter is not implemented, not verified", async () => {
  assert.equal((await qualify("github.live", manifest())).status, "NOT_IMPLEMENTED");
});
test("test PR operations require separate explicit approval before execution", async () => {
  assert.equal((await qualify("github.remediation.live", manifest(), contract("github.remediation.live"))).reason, "NOT_APPROVED");
});
test("contract driver cannot promote synthetic evidence even if it labels evidence live", async () => {
  const result = await qualify("github.live", manifest(), contract("github.live", { live: true }));
  assert.equal(result.status, "UNVERIFIED"); assert.equal(result.reason, "CONTRACT_ONLY"); assert.equal(result.live, false);
});
test("wrong tenant, project or configuration observations fail closed and clean up", async () => {
  for (const change of [{ organizationId: randomUUID() }, { projectId: randomUUID() }, { configurationDigest: `sha256:${"b".repeat(64)}` }]) {
    let cleaned = false; const driver = contract("github.live", change); driver.cleanup = async () => { cleaned = true; return true; };
    assert.equal((await qualify("github.live", manifest(), driver)).status, "DEGRADED"); assert.equal(cleaned, true);
  }
});
test("failed cleanup cannot produce verification and provider errors remain redacted", async () => {
  const driver = contract("github.live"); driver.exercise = async () => { throw new Error("raw-provider-secret"); }; driver.cleanup = async () => false;
  const result = await qualify("github.live", manifest(), driver);
  assert.equal(result.status, "DEGRADED"); assert.equal(result.reason, "CLEANUP_FAILED"); assert.ok(!JSON.stringify(result).includes("raw-provider-secret"));
});
test("AI diagnostics do not execute without a bounded current quote and reservation", async () => {
  let calls = 0; const driver = contract("openai.live"), run = driver.exercise; driver.exercise = async (...args) => { calls++; return run(...args); };
  const m = manifest();
  assert.equal((await qualify("openai.live", m, driver)).reason, "BUDGET_UNBOUNDED");
  for (const ceilingMicroUsd of [0, -1, 100001, NaN, Infinity]) await qualify("openai.live", m, driver, Date.now(), { ceilingMicroUsd, pricingExpiresAt: Date.now() + 60000, store: { async command() { throw new Error(); } } });
  assert.equal(calls, 0);
  const order: string[] = [];
  driver.exercise = async (...args) => { order.push("provider"); return run(...args); };
  await qualify("openai.live", m, driver, Date.now(), { ceilingMicroUsd: 1000, pricingExpiresAt: Date.now() + 60000, store: { async command(action) { assert.equal(action, "QUALIFICATION_BUDGET"); order.push("reserve"); return {}; } } });
  assert.deepEqual(order, ["reserve", "provider"]);
});
test("reservation failure prevents the provider call", async () => {
  const driver = contract("anthropic.live"); driver.exercise = async () => { throw new Error("MUST_NOT_CALL"); };
  const result = await qualify("anthropic.live", manifest(), driver, Date.now(), { ceilingMicroUsd: 1000, pricingExpiresAt: Date.now() + 60000, store: { async command() { throw new Error("budget denied"); } } });
  assert.equal(result.reason, "BUDGET_UNBOUNDED");
});
test("required readiness includes Checks, hosted execution, recovery and cleanup", () => {
  const statuses = Object.fromEntries(qualificationNames.map(n => [n, "VERIFIED" as const]));
  for (const name of ["github.checks.live", "staging.deployment", "staging.recovery", "staging.cleanup"] as const) assert.equal(launchPolicy({ ...statuses, [name]: "UNVERIFIED" }).productionReady, false);
  assert.equal(launchPolicy({ ...statuses, "openai.live": "UNVERIFIED" }).productionReady, true);
  assert.equal(launchPolicy({ ...statuses, "openai.live": "UNVERIFIED" }, ["openai"]).productionReady, false);
});
test("configuration-stale qualification never survives registry projection", () => {
  const now = Date.now();
  assert.equal(capabilityRegistry("staging", [{ capability: "github.live", environment: "staging", status: "VERIFIED", live: true, evidenceDigest: `sha256:${"a".repeat(64)}`, observedAt: now - 1000, expiresAt: now + 60000, freshness: "STALE" }], now)["github.live"], "UNVERIFIED");
});
test("runtime fingerprint changes on credential rotation and excludes unrelated process variables", () => {
  const env = { OPENAI_API_KEY: "synthetic-old", LAUNCHGATE_SECRET_VERSION: "one" };
  const initial = runtimeConfigurationDigest(env);
  assert.notEqual(initial, runtimeConfigurationDigest({ ...env, OPENAI_API_KEY: "synthetic-new" }));
  assert.notEqual(initial, runtimeConfigurationDigest({ ...env, LAUNCHGATE_SECRET_VERSION: "two" }));
  assert.equal(initial, runtimeConfigurationDigest({ ...env, UNRELATED: "value" }));
  assert.ok(!initial.includes("synthetic"));
});
test("qualification reader invalidates credentials changed after database qualification", async () => {
  const organizationId = randomUUID();
  const row = { organization_id: organizationId, environment: "staging", capability: "github.live", status: "VERIFIED", evidence_digest: `sha256:${"a".repeat(64)}`, live: true, observed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), runtime_digest: runtimeConfigurationDigest() };
  const store = { async command() { return [row]; } };
  assert.equal((await qualificationReader(store, organizationId, "staging")())[0].status, "VERIFIED");
  row.runtime_digest = `sha256:${"b".repeat(64)}`;
  const stale = (await qualificationReader(store, organizationId, "staging")())[0];
  assert.equal(stale.status, "UNVERIFIED"); assert.equal(stale.freshness, "STALE"); assert.equal(stale.reason, "CONFIGURATION_CHANGED");
});
