import assert from "node:assert/strict";
import { test } from "node:test";
import type { Evidence } from "@launchgate/contracts";
import { evidenceDigest } from "@launchgate/verification-core";
import { evaluateRelease } from "../services/releases/engine";
import { releaseFixture } from "./fixtures/release";
for (const [key, value] of [["commitSha", "b".repeat(40)], ["deploymentId", "deployment-b"], ["policyId", "policy-b"], ["policyVersion", 2], ["invariantVersion", 2], ["organizationId", "other-org"], ["projectId", "other-project"]] as const)
  test(`stale evidence ${key} never approves or blocks`, () => {
    for (const variant of ["fixed", "vulnerable"] as const) {
      const f = releaseFixture(variant), e = f.evidence[0].evidence as Evidence;
      Object.assign(e.scope, { [key]: value }); if (e.reproduction.status === "REPRODUCED") e.reproduction.scope = { ...e.scope }; f.evidence[0].manifestDigest = evidenceDigest(e);
      const result = evaluateRelease(f); assert.equal(result.decision, "INCONCLUSIVE"); assert.equal(result.coverage[0].status, "STALE");
    }
  });
for (const key of ["testVersion", "fixtureVersion", "planHash"] as const) test(`changed ${key} invalidates coverage`, () => {
  const f = releaseFixture(); Object.assign(f.evidence[0], { [key]: key === "fixtureVersion" ? 2 : "changed" }); assert.equal(evaluateRelease(f).coverage[0].status, "STALE");
});
test("runner version invalidates evidence", () => { const f = releaseFixture(), e = f.evidence[0].evidence as Evidence; e.runner.version = "2"; f.evidence[0].manifestDigest = evidenceDigest(e); assert.equal(evaluateRelease(f).coverage[0].status, "STALE"); });
test("expiry and revocation invalidate authorization", () => {
  for (const update of [{ expiresAt: "2026-10-11T00:00:10.000Z" }, { revokedAt: "2026-10-11T00:00:09.000Z" }]) { const f = releaseFixture(); Object.assign(f.evidence[0].authorization, update); assert.equal(evaluateRelease(f).coverage[0].status, "STALE"); }
});
test("freshness window and future observations are rejected", () => {
  const f = releaseFixture(); assert.equal(evaluateRelease({ ...f, now: "2026-10-11T00:02:00.000Z" }).coverage[0].status, "STALE");
  assert.equal(evaluateRelease({ ...f, now: "2026-10-11T00:00:02.000Z" }).coverage[0].status, "STALE");
});
test("deployment commit mismatch never approves or labels vulnerability", () => {
  for (const variant of ["fixed", "vulnerable"] as const) { const f = releaseFixture(variant); f.release.deploymentCommitSha = "b".repeat(40); assert.equal(evaluateRelease(f).decision, "INCONCLUSIVE"); }
});
