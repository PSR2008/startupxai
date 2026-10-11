import assert from "node:assert/strict";
import { test } from "node:test";
import { invariantExamples, invariantSchema } from "@launchgate/invariant-spec";
import { targetAuthorizationSchema } from "@launchgate/contracts";

for (const example of invariantExamples) test(`valid invariant example: ${example.domain}`, () => {
  assert.equal(invariantSchema.safeParse(example).success, true);
});
for (const mutation of [
  { version: 0 }, { version: 1.2 }, { domain: "unrestricted" }, { schemaVersion: 2 },
  { operation: { ...invariantExamples[0].operation, kind: "shell.exec" } },
  { operation: { ...invariantExamples[0].operation, command: "curl attacker" } },
  { operation: { ...invariantExamples[0].operation, maxAttempts: Infinity } },
  { operation: { ...invariantExamples[0].operation, actor: "unbound" } },
  { assertions: [] }, { preconditions: [] },
]) test(`invariant rejects ${JSON.stringify(mutation)}`, () => {
  assert.equal(invariantSchema.safeParse({ ...invariantExamples[0], ...mutation }).success, false);
});
const authorization = {
  id: "auth-1", organizationId: "org", projectId: "project", targetHost: "staging.customer.test",
  method: "DEPLOYMENT_CHALLENGE", proofReference: "proof-1",
  authorizingPrincipal: { userId: "owner", origin: "supabase_verified_bearer" },
  allowedHosts: ["staging.customer.test"], allowedPorts: [443], allowedOperations: ["resource.read"],
  startsAt: "2026-10-11T00:00:00.000Z", expiresAt: "2026-10-12T00:00:00.000Z",
  requestLimit: 100, requestsPerSecond: 2, concurrencyLimit: 2, spendLimit: { currency: "USD", micros: 0 }, revocation: { state: "ACTIVE" },
};
test("bounded target authorization contract accepts explicit control proof", () => {
  assert.equal(targetAuthorizationSchema.safeParse(authorization).success, true);
});
test("repository access, wildcard host and unbounded/expired windows are not authorization", () => {
  for (const change of [{ method: "GITHUB_REPOSITORY_ACCESS" }, { allowedHosts: ["*"] }, { concurrencyLimit: 1000 }, { expiresAt: authorization.startsAt }, { allowedOperations: ["shell.exec"] }]) {
    assert.equal(targetAuthorizationSchema.safeParse({ ...authorization, ...change }).success, false);
  }
});
