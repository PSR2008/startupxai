import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inspectEnvironment, configurationReadiness, publicHealth, configuredValue } from "../src/server/env";
import { principalFromRequest } from "../src/server/auth/principal";
import { ApiError, serializeApiError } from "../src/server/http/api-error";
import { GET } from "../src/app/api/health/route";

test("missing environment is explicit and liveness remains independent", () => {
  assert.ok(Object.values(inspectEnvironment({})).every(v => v === "missing"));
  assert.ok(Object.values(configurationReadiness({})).every(v => !v));
  assert.equal(publicHealth({}).liveness, "alive");
  assert.equal(publicHealth({}).configuration, "incomplete");
});
test("the actual example placeholders are not configured", () => {
  const env = Object.fromEntries(readFileSync('.env.example', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
  const report = inspectEnvironment(env);
  assert.equal(report.NEXT_PUBLIC_SUPABASE_URL, "placeholder");
  assert.equal(report.ANTHROPIC_API_KEY, "placeholder");
  assert.equal(report.RAZORPAY_KEY_SECRET, "placeholder");
  assert.equal(publicHealth(env).configuration, "incomplete");
});
test("malformed values fail without exposing values or validation errors", () => {
  const sensitive = 'malformed-secret-do-not-serialize';
  const input = { NEXT_PUBLIC_SUPABASE_URL: sensitive, ANTHROPIC_API_KEY: sensitive };
  assert.equal(inspectEnvironment(input).ANTHROPIC_API_KEY, "malformed");
  assert.equal(configuredValue("ANTHROPIC_API_KEY", input), undefined);
  assert.ok(!JSON.stringify(inspectEnvironment(input)).includes(sensitive));
  assert.ok(!JSON.stringify(publicHealth(input)).includes(sensitive));
});
test("structurally configured values do not assert provider connectivity", () => {
  // Offline test inputs; never written into environment files or used for requests.
  const report = inspectEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://unit.supabase.co", IP_HASH_SALT: "s".repeat(40) });
  assert.equal(report.NEXT_PUBLIC_SUPABASE_URL, "configured");
  assert.equal(report.IP_HASH_SALT, "configured");
  assert.equal(publicHealth({}).integrations, "not_probed");
});
test("health endpoint is live, uncached and discloses no provider flags", async () => {
  const response = await GET(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.liveness, "alive");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(body.checks, {}); assert.equal(body.productionReadiness, "not_assessed");
});
test("principal comes from verified identity rather than request user ID", async () => {
  const request = new Request("https://local.test", { headers: { authorization: "Bearer test-token", "x-user-id": "attacker" } });
  const principal = await principalFromRequest(request, async token => { assert.equal(token, "test-token"); return { userId: "verified-user" }; });
  assert.deepEqual(principal, { userId: "verified-user", origin: "supabase_verified_bearer" });
  assert.ok(Object.isFrozen(principal));
});
test("principal denies missing/malformed auth and verifier rejection or crash", async () => {
  for (const value of ["", "Basic test", "Bearer one two"]) {
    assert.equal(await principalFromRequest(new Request("https://local.test", { headers: { authorization: value } }), async () => { throw new Error("must not call"); }), null);
  }
  const req = new Request("https://local.test", { headers: { authorization: "Bearer token" } });
  assert.equal(await principalFromRequest(req, async () => null), null);
  assert.equal(await principalFromRequest(req, async () => { throw new Error("provider-secret"); }), null);
});
test("safe API errors serialize deterministically without cause/context/stack", () => {
  const e = new ApiError("ACCESS_DENIED", { cause: new Error("database-secret"), context: { key: "provider-secret" }, correlationId: "request-1" });
  assert.deepEqual(serializeApiError(e), { status: 403, body: { ok: false, error: { code: "ACCESS_DENIED", message: "You do not have access to this resource.", correlationId: "request-1" } } });
  assert.ok(!JSON.stringify(e).includes("secret")); assert.ok(!JSON.stringify(e).includes("stack"));
  assert.equal(serializeApiError(new Error("sensitive")).body.error.code, "INTERNAL_ERROR");
  assert.equal(new ApiError("INTERNAL_ERROR", { correlationId: "invalid\nheader" }).correlationId, undefined);
});
