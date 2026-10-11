import { createHash } from "node:crypto";
import { evidenceSchema, sameCandidate, type Evidence, type EvidenceAdmission, type Attempt, type Scope } from "@launchgate/contracts";
import { invariantSchema, type Invariant } from "@launchgate/invariant-spec";

export type Outcome = "PASS" | "REPRODUCIBLE_FAILURE" | "INCONCLUSIVE";
export interface Evaluation {
  outcome: Outcome;
  applicability: Invariant["applicability"]["status"];
  reason: string;
  scope?: Scope;
}
const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
export const planDigest = (spec: Invariant): string => digest(invariantSchema.parse(spec));
export const evidenceDigest = (evidence: Evidence): string => digest(evidenceSchema.parse(evidence));
export function failureSignature(spec: Invariant, attempt: Attempt): string {
  return digest(spec.assertions.map(a => ({ id: a.id, expected: a.expected,
    observed: attempt.observations.find(o => o.id === a.observation)?.value ?? null })));
}
function evaluateAttempt(spec: Invariant, attempt: Attempt): boolean[] | null {
  if (attempt.execution !== "COMPLETED") return null;
  for (const rows of [attempt.preconditions, attempt.observations, attempt.assertions]) {
    if (new Set(rows.map(r => r.id)).size !== rows.length) return null;
  }
  if (attempt.preconditions.length !== spec.preconditions.length ||
      !spec.preconditions.every(id => attempt.preconditions.some(p => p.id === id && p.passed))) return null;
  if (attempt.assertions.length !== spec.assertions.length) return null;
  const results: boolean[] = [];
  for (const assertion of spec.assertions) {
    const observed = attempt.observations.find(o => o.id === assertion.observation);
    if (!observed || typeof observed.value !== typeof assertion.expected) return null;
    const passed = assertion.comparator === "equals" ? observed.value === assertion.expected
      : assertion.comparator === "not_equals" ? observed.value !== assertion.expected
      : typeof observed.value === "number" && typeof assertion.expected === "number" && observed.value <= assertion.expected;
    if (attempt.assertions.find(a => a.id === assertion.id)?.passed !== passed) return null;
    results.push(passed);
  }
  return results;
}

/** Pure policy semantics, NOT evidence authentication. Admission is trusted service input. */
export function evaluateOutcome(specInput: unknown, evidenceInput: unknown, admission: EvidenceAdmission = { kind: "UNTRUSTED" }): Evaluation {
  const parsedSpec = invariantSchema.safeParse(specInput);
  const inconclusive = (reason: string, scope?: Scope): Evaluation => ({ outcome: "INCONCLUSIVE",
    applicability: parsedSpec.success ? parsedSpec.data.applicability.status : "UNDETERMINED", reason, ...(scope ? { scope } : {}) });
  if (!parsedSpec.success) return inconclusive("INVALID_SPECIFICATION");
  const spec = parsedSpec.data;
  if (spec.applicability.status !== "APPLICABLE") return inconclusive(spec.applicability.status);
  if (spec.confirmation.status !== "CONFIRMED") return inconclusive("UNCONFIRMED_INVARIANT");
  const parsed = evidenceSchema.safeParse(evidenceInput);
  if (!parsed.success) return inconclusive("MISSING_OR_INVALID_EVIDENCE");
  const e = parsed.data;
  const unknown = (reason: string) => inconclusive(reason, e.scope);
  if (e.source !== "DETERMINISTIC_EXECUTION") return unknown("NON_DETERMINISTIC_SOURCE");
  const admitted = e.scope.purpose === "REFERENCE_LAB"
    ? admission.kind === "REFERENCE_LAB"
    : admission.kind === "AUTHENTICATED_RUNNER" && admission.runId === e.runId && admission.manifestDigest === evidenceDigest(e);
  if (!admitted) return unknown("UNTRUSTED_EVIDENCE");
  if (e.scope.invariantId !== spec.id || e.scope.invariantVersion !== spec.version || e.planDigest !== planDigest(spec)) return unknown("SPECIFICATION_MISMATCH");
  if (!e.runner.imageDigest || e.artifacts.some(a => a.redaction === "PENDING") ||
      new Set(e.artifacts.map(a => a.id)).size !== e.artifacts.length) return unknown("INCOMPLETE_PROVENANCE");
  if (Date.parse(e.createdAt) < Date.parse(e.original.completedAt)) return unknown("INVALID_CHRONOLOGY");
  const original = evaluateAttempt(spec, e.original);
  if (!original) return unknown("EXECUTION_OR_CONTROL_INCOMPLETE");
  if (original.every(Boolean)) {
    if (e.original.failureSignature !== null || e.reproduction.status !== "NOT_ATTEMPTED") return unknown("CONFLICTING_EVIDENCE");
    return { outcome: "PASS", applicability: "APPLICABLE", reason: "ASSERTIONS_SATISFIED", scope: e.scope };
  }
  if (e.original.failureSignature !== failureSignature(spec, e.original)) return unknown("INVALID_FAILURE_SIGNATURE");
  if (e.reproduction.status !== "REPRODUCED") return unknown("REPRODUCTION_REQUIRED");
  const r = e.reproduction;
  if (!sameCandidate(e.scope, r.scope) || r.scope.invariantId !== spec.id || r.scope.invariantVersion !== spec.version ||
      r.planDigest !== e.planDigest || r.fixtureSeed !== e.fixture.seed || r.attempt.id === e.original.id ||
      r.attempt.fixtureStateDigest !== e.original.fixtureStateDigest ||
      Date.parse(r.attempt.completedAt) < Date.parse(e.original.completedAt) || Date.parse(r.attempt.completedAt) > Date.parse(e.createdAt)) return unknown("REPLAY_SCOPE_MISMATCH");
  const replay = evaluateAttempt(spec, r.attempt);
  if (!replay || replay.every(Boolean) || r.attempt.failureSignature !== failureSignature(spec, r.attempt) ||
      r.attempt.failureSignature !== e.original.failureSignature) return unknown("FAILURE_NOT_REPRODUCED");
  return { outcome: "REPRODUCIBLE_FAILURE", applicability: "APPLICABLE", reason: "DETERMINISTIC_FAILURE_REPRODUCED", scope: e.scope };
}
