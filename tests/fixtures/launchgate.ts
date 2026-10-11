import { evidenceSchema, type Candidate, type Evidence, type ReferenceFixture } from "@launchgate/contracts";
import { invariantExamples, type Invariant } from "@launchgate/invariant-spec";
import { failureSignature, planDigest } from "@launchgate/verification-core";

export const candidate: Candidate = {
  organizationId: "lab-org", projectId: "lab-project", commitSha: "a".repeat(40),
  deploymentId: "lab-deployment", policyId: "lab-policy", policyVersion: 1,
  evidenceScope: "lab-scope-v1", purpose: "REFERENCE_LAB",
};
export const hash = `sha256:${"b".repeat(64)}`;
export const spec = invariantExamples[0];
export function fixtureEvidence(variant: "vulnerable" | "fixed" | "inconclusive", invariant: Invariant = spec): Evidence {
  const failed = variant === "vulnerable";
  const e: Evidence = {
    schemaVersion: 1, runId: "lab-run", scope: { ...candidate, invariantId: invariant.id, invariantVersion: invariant.version },
    source: "DETERMINISTIC_EXECUTION", runner: { identity: "pure-reference-lab", version: "1", imageDigest: hash },
    fixture: { seed: "seed-1", logicalIdentities: ["tenant-a-member", "tenant-b-owner", "tenant-b-resource"] },
    planDigest: planDigest(invariant),
    original: {
      id: "attempt-1", completedAt: "2026-10-11T00:00:01.000Z",
      execution: variant === "inconclusive" ? "UNOBSERVABLE" : "COMPLETED",
      preconditions: invariant.preconditions.map(id => ({ id, passed: true })),
      observations: invariant.assertions.map(a => ({ id: a.observation, value: failed ? (typeof a.expected === "boolean" ? !a.expected : typeof a.expected === "number" ? a.expected + 1 : "different") : a.expected })),
      assertions: invariant.assertions.map(a => ({ id: a.id, passed: !failed })),
      fixtureStateDigest: hash, failureSignature: null,
    },
    reproduction: { status: "NOT_ATTEMPTED" },
    artifacts: [{ id: "synthetic-observations", hash, classification: "INTERNAL", redaction: "NO_SENSITIVE_DATA" }],
    createdAt: "2026-10-11T00:00:03.000Z",
  };
  if (failed) {
    e.original.failureSignature = failureSignature(invariant, e.original);
    e.reproduction = { status: "REPRODUCED", scope: { ...e.scope }, planDigest: e.planDigest, fixtureSeed: e.fixture.seed,
      attempt: { ...structuredClone(e.original), id: "attempt-2", completedAt: "2026-10-11T00:00:02.000Z" } };
  }
  return evidenceSchema.parse(e);
}
export function fixtureFamily(family: ReferenceFixture["family"], domain: Invariant["domain"]): ReferenceFixture {
  const observations = {
    tenant_isolation: ["foreign_data_visible", false],
    privilege_escalation: ["member_became_owner", false],
    paid_feature_bypass: ["free_actor_paid_operation", false],
    payment_entitlement_integrity: ["failed_payment_entitlements", 0],
    webhook_duplicate_replay: ["credits_after_duplicate", 1],
    ai_quota_cost_bypass: ["disallowed_upstream_calls", 0],
    distributed_usage_enforcement: ["units_consumed_at_limit", 1],
    auth_session_boundaries: ["expired_session_access", false],
  } as const;
  const [observation, expected] = observations[family];
  return { family, domain, version: 1, seed: "seed-1", setupRequirements: ["positive_control"],
    oracle: { id: "assertion", observation, comparator: family === "distributed_usage_enforcement" ? "at_most" : "equals", expected },
    variants: {
      vulnerable: { identity: `${family}.vulnerable`, expectedOutcome: "REPRODUCIBLE_FAILURE" },
      fixed: { identity: `${family}.fixed`, expectedOutcome: "PASS" },
      inconclusive: { identity: `${family}.inconclusive`, expectedOutcome: "INCONCLUSIVE" },
    } };
}
