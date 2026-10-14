import assert from "node:assert/strict";
import { test } from "node:test";
import { evidenceDigest } from "@launchgate/verification-core";
import type { Evidence } from "@launchgate/contracts";
import { evaluateRelease, invariantSetDigest } from "../services/releases/engine";
import type { PolicyException } from "../services/releases/contracts";
import { releaseFixture } from "./fixtures/release";

for (const [variant, decision] of [["fixed", "SHIP"], ["vulnerable", "BLOCK"], ["inconclusive", "INCONCLUSIVE"]] as const)
  test(`release gate ${variant} -> ${decision} from reevaluated evidence`, () => assert.equal(evaluateRelease(releaseFixture(variant)).decision, decision));
test("coverage missing, ambiguous and fabricated verdicts never approve", () => {
  const f = releaseFixture();
  assert.equal(evaluateRelease({ ...f, evidence: [] }).coverage[0].status, "NOT_RUN");
  assert.equal(evaluateRelease({ ...f, evidence: [...f.evidence, ...f.evidence] }).decision, "INCONCLUSIVE");
  f.evidence[0].evidence = { outcome: "PASS" };
  assert.equal(evaluateRelease(f).decision, "INCONCLUSIVE");
});
test("optional nonblocking coverage is counted separately", () => {
  const f = releaseFixture(); f.policy.requirements.push({ ...f.policy.requirements[0], invariant: { ...f.policy.requirements[0].invariant, id: "advisory" }, required: false });
  f.release.invariantSetDigest = invariantSetDigest(f.policy);
  const result = evaluateRelease(f); assert.equal(result.decision, "SHIP"); assert.equal(result.counts.requiredTotal, 1); assert.equal(result.counts.NOT_RUN, 0); assert.equal(result.coverage[1].status, "NOT_RUN");
});
test("not applicable needs exact provenance and cannot alone approve", () => {
  const f = releaseFixture(); f.policy.requirements[0].invariant.applicability = { status: "NOT_APPLICABLE", reason: "No relevant resource", approvedBy: "owner" };
  assert.equal(evaluateRelease(f).coverage[0].status, "INCONCLUSIVE");
  f.policy.requirements[0].applicabilityProof = { commitSha: f.release.candidate.commitSha, snapshotId: null, digest: f.evidence[0].planHash };
  const r = evaluateRelease(f); assert.equal(r.coverage[0].status, "NOT_APPLICABLE"); assert.equal(r.decision, "INCONCLUSIVE");
});
test("nonblocking severity does not waive a required failure", () => { const f = releaseFixture("vulnerable"); f.policy.blockingSeverities = []; assert.equal(evaluateRelease(f).decision, "INCONCLUSIVE"); });
test("model output and unadmitted manifests have no decision authority", () => {
  for (const source of ["MODEL_OUTPUT", "USER_CLAIM"] as const) {
    const f = releaseFixture("vulnerable"), e = f.evidence[0].evidence as Evidence; e.source = source; f.evidence[0].manifestDigest = evidenceDigest(e);
    assert.equal(evaluateRelease(f).decision, "INCONCLUSIVE");
  }
  const f = releaseFixture(); f.evidence[0].admission = { kind: "UNTRUSTED" }; assert.equal(evaluateRelease(f).decision, "INCONCLUSIVE");
});
function waiver(): PolicyException {
  const f = releaseFixture(); return { id: "waiver-1", organizationId: f.release.candidate.organizationId, projectId: f.release.candidate.projectId, releaseId: f.release.id, policyId: f.policy.id, policyVersion: 1, invariantId: f.policy.requirements[0].invariant.id, findingId: null, reason: "Accepted risk", actorId: "owner", actorRole: "OWNER", createdAt: f.release.createdAt, expiresAt: "2026-10-11T00:30:00.000Z", revokedAt: null, ticket: null };
}
test("explicit scoped waiver permits policy exception without rewriting failure", () => {
  const result = evaluateRelease({ ...releaseFixture("vulnerable"), exceptions: [waiver()] });
  assert.equal(result.decision, "SHIP"); assert.equal(result.coverage[0].status, "REPRODUCIBLE_FAILURE"); assert.equal(result.counts.PASS, 0); assert.deepEqual(result.exceptions, ["waiver-1"]);
});
test("finding-specific exception applies only to its exact reproduced signature",()=>{
  const f=releaseFixture("vulnerable"),finding={id:"finding-1",invariantId:f.policy.requirements[0].invariant.id,invariantVersion:1,state:"REPRODUCED",origin:f.evidence[0],unchangedProof:null,regressionInvariantId:null};
  assert.equal(evaluateRelease({...f,findings:[finding],exceptions:[{...waiver(),findingId:finding.id}]}).decision,"SHIP");
  assert.equal(evaluateRelease({...f,findings:[finding],exceptions:[{...waiver(),findingId:"other"}]}).decision,"BLOCK");
});
for (const [key, value] of [["expiresAt", "2026-10-11T00:00:09.000Z"], ["revokedAt", "2026-10-11T00:00:05.000Z"], ["projectId", "other"], ["releaseId", "other"], ["invariantId", "other"], ["policyVersion", 2], ["createdAt", "2026-10-12T00:00:00.000Z"]] as const)
  test(`waiver ${key} mismatch does not bypass policy`, () => assert.equal(evaluateRelease({ ...releaseFixture("vulnerable"), exceptions: [{ ...waiver(), [key]: value }] }).decision, "BLOCK"));
test("deterministic evaluation records sealed manifests and bounded validity without mutating inputs", () => { const f = releaseFixture(); f.evidence[0].sealedManifestDigest=`sha256:${"c".repeat(64)}`;const before = structuredClone(f); assert.deepEqual(evaluateRelease(f), evaluateRelease(f)); assert.deepEqual(evaluateRelease(f).manifests,[f.evidence[0].sealedManifestDigest]);assert.equal(evaluateRelease(f).validUntil,"2026-10-11T00:01:03.000Z");assert.deepEqual(f, before); });
test("unresolved unchanged historical reproduced finding remains blocking", () => {
  const current = releaseFixture(), previous = releaseFixture("vulnerable");
  (previous.evidence[0].evidence as Evidence).scope.commitSha = "b".repeat(40);
  const e = previous.evidence[0].evidence as Evidence; if (e.reproduction.status === "REPRODUCED") e.reproduction.scope = { ...e.scope };
  previous.evidence[0].manifestDigest = evidenceDigest(e);
  const finding = { id: "finding-1", invariantId: e.scope.invariantId, invariantVersion: 1, state: "REPRODUCED", origin: previous.evidence[0], unchangedProof: { releaseId: current.release.id, invariantVersion: 1, digest: previous.evidence[0].planHash, complete: true }, regressionInvariantId: null };
  assert.equal(evaluateRelease({ ...current, findings: [finding] }).decision, "BLOCK");
  assert.equal(evaluateRelease({ ...current, findings: [{ ...finding, unchangedProof: null }] }).decision, "INCONCLUSIVE");
});
test("resolved finding requires fresh regression pass; reintroduction blocks", () => {
  const f = releaseFixture(), origin = releaseFixture("vulnerable").evidence[0];
  f.policy.requirements[0].kind = "REGRESSION";
  const finding = { id: "finding-1", invariantId: f.policy.requirements[0].invariant.id, invariantVersion: 1, state: "RESOLVED", origin, unchangedProof: null, regressionInvariantId: f.policy.requirements[0].invariant.id };
  assert.equal(evaluateRelease({ ...f, findings: [finding] }).decision, "SHIP");
  assert.equal(evaluateRelease({ ...f, evidence: [origin], findings: [finding] }).decision, "BLOCK");
});
