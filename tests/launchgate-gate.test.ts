import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateGate, evaluateOutcome, evidenceDigest, type GatePolicy } from "@launchgate/verification-core";
import { candidate, fixtureEvidence, spec } from "./fixtures/launchgate";
import type { Evidence } from "@launchgate/contracts";

const admission = { kind: "REFERENCE_LAB" as const };
const policy: GatePolicy = { id: candidate.policyId, version: 1, blockingSeverities: ["critical", "high"], requirements: [{ invariant: spec, required: true }] };
const submit = (evidence: unknown, invariantId = spec.id) => ({ invariantId, evidence, admission });
test("successful deterministic assertions pass and exact required coverage ships", () => {
  const e = fixtureEvidence("fixed");
  assert.equal(evaluateOutcome(spec, e, admission).outcome, "PASS");
  assert.equal(evaluateGate(candidate, policy, [submit(e)]).decision, "SHIP");
});
test("a reproduced failure blocks only according to policy", () => {
  const e = fixtureEvidence("vulnerable");
  assert.equal(evaluateOutcome(spec, e, admission).outcome, "REPRODUCIBLE_FAILURE");
  assert.equal(evaluateGate(candidate, policy, [submit(e)]).decision, "BLOCK");
  assert.equal(evaluateGate(candidate, { ...policy, blockingSeverities: [] }, [submit(e)]).decision, "INCONCLUSIVE");
});
test("optional nonblocking finding does not prevent passing required scope", () => {
  const optional = { ...spec, id: "optional", severity: "low" as const };
  const p = { ...policy, requirements: [...policy.requirements, { invariant: optional, required: false }] };
  assert.equal(evaluateGate(candidate, p, [submit(fixtureEvidence("fixed")), submit(fixtureEvidence("vulnerable", optional), optional.id)]).decision, "SHIP");
});
test("violation without reproduction remains inconclusive", () => {
  const e = fixtureEvidence("vulnerable"); e.reproduction = { status: "NOT_ATTEMPTED" };
  assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
});
for (const execution of ["TIMEOUT", "MISSING_CREDENTIALS", "SETUP_FAILED", "TARGET_UNAVAILABLE", "RUNNER_ERROR", "UNOBSERVABLE"] as const) {
  test(`${execution} never creates a failure or approval`, () => {
    const e = fixtureEvidence("vulnerable"); e.original.execution = execution;
    assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
    assert.equal(evaluateGate(candidate, policy, [submit(e)]).decision, "INCONCLUSIVE");
  });
}
test("failed or missing positive controls are inconclusive", () => {
  for (const preconditions of [[], [{ id: "positive_control", passed: false }]]) {
    const e = fixtureEvidence("vulnerable"); e.original.preconditions = preconditions;
    assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
  }
});
test("model/user claims and untrusted evidence cannot create pass or failure", () => {
  for (const source of ["MODEL_OUTPUT", "USER_CLAIM"] as const) {
    const e = fixtureEvidence("vulnerable"); e.source = source;
    assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
  }
  assert.equal(evaluateOutcome(spec, fixtureEvidence("fixed")).outcome, "INCONCLUSIVE");
});
test("NOT_APPLICABLE is metadata and never PASS or sufficient coverage", () => {
  const n = { ...spec, applicability: { status: "NOT_APPLICABLE" as const, reason: "No billing", approvedBy: "owner" } };
  assert.equal(evaluateOutcome(n, null, admission).outcome, "INCONCLUSIVE");
  const gate = evaluateGate(candidate, { ...policy, requirements: [{ invariant: n, required: true }] }, []);
  assert.equal(gate.decision, "INCONCLUSIVE"); assert.deepEqual(gate.notApplicable, [spec.id]);
});
test("missing and duplicate coverage cannot ship", () => {
  assert.equal(evaluateGate(candidate, policy, []).decision, "INCONCLUSIVE");
  const s = submit(fixtureEvidence("fixed"));
  assert.equal(evaluateGate(candidate, policy, [s, s]).decision, "INCONCLUSIVE");
});
for (const field of ["organizationId", "projectId", "commitSha", "deploymentId", "policyId", "policyVersion", "evidenceScope", "purpose"] as const) {
  test(`stale ${field} cannot approve or block the candidate`, () => {
    for (const variant of ["fixed", "vulnerable"] as const) {
      const e = fixtureEvidence(variant);
      const changes = { organizationId: "other-org", projectId: "other-project", commitSha: "c".repeat(40), deploymentId: "other-deploy", policyId: "other-policy", policyVersion: 2, evidenceScope: "other-scope", purpose: "CUSTOMER_VERIFICATION" };
      Object.assign(e.scope, { [field]: changes[field] });
      if (e.reproduction.status === "REPRODUCED") e.reproduction.scope = { ...e.scope };
      assert.equal(evaluateGate(candidate, policy, [submit(e)]).decision, "INCONCLUSIVE");
    }
  });
}
const mutations: Record<string, (e: Evidence) => void> = {
  "missing image digest": e => { e.runner.imageDigest = null; },
  "pending redaction": e => { e.artifacts[0].redaction = "PENDING"; },
  "assertion inconsistent with observation": e => { e.original.assertions[0].passed = true; },
  "missing observation": e => { e.original.observations = []; },
  "duplicate observation": e => { e.original.observations.push(e.original.observations[0]); },
  "wrong invariant version": e => { e.scope.invariantVersion++; },
  "wrong plan": e => { e.planDigest = `sha256:${"f".repeat(64)}`; },
  "replayed same attempt": e => { if (e.reproduction.status === "REPRODUCED") e.reproduction.attempt.id = e.original.id; },
  "replay seed mismatch": e => { if (e.reproduction.status === "REPRODUCED") e.reproduction.fixtureSeed = "other"; },
  "replay target mismatch": e => { if (e.reproduction.status === "REPRODUCED") e.reproduction.scope.deploymentId = "other"; },
  "replay crash": e => { if (e.reproduction.status === "REPRODUCED") e.reproduction.attempt.execution = "RUNNER_ERROR"; },
  "forged signature": e => { e.original.failureSignature = `sha256:${"d".repeat(64)}`; },
};
for (const [name, mutate] of Object.entries(mutations)) test(`${name} is inconclusive`, () => {
  const e = fixtureEvidence("vulnerable"); mutate(e);
  assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
});
test("customer evidence requires service admission bound to manifest and run", () => {
  const e = fixtureEvidence("fixed"); e.scope.purpose = "CUSTOMER_VERIFICATION";
  assert.equal(evaluateOutcome(spec, e, admission).outcome, "INCONCLUSIVE");
  const trusted = { kind: "AUTHENTICATED_RUNNER" as const, runId: e.runId, manifestDigest: evidenceDigest(e) };
  assert.equal(evaluateOutcome(spec, e, trusted).outcome, "PASS");
  e.runId = "changed";
  assert.equal(evaluateOutcome(spec, e, trusted).outcome, "INCONCLUSIVE");
});
test("malformed policy, unconfirmed invariant and fabricated verdict fail closed", () => {
  assert.equal(evaluateGate(candidate, { ...policy, version: 2 }, []).decision, "INCONCLUSIVE");
  assert.equal(evaluateOutcome({ ...spec, confirmation: { status: "PROPOSED" } }, fixtureEvidence("fixed"), admission).outcome, "INCONCLUSIVE");
  assert.equal(evaluateGate(candidate, policy, [submit({ outcome: "PASS" })]).decision, "INCONCLUSIVE");
});
