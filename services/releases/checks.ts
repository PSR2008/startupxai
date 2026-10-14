import type { ReleaseEvaluation } from "./engine";

export function checkConclusion(decision: ReleaseEvaluation["decision"]): "success" | "failure" | "action_required" {
  return decision === "SHIP" ? "success" : decision === "BLOCK" ? "failure" : "action_required";
}
// An allowlist of generated identifiers and aggregate counts. Never serialize
// statements, observations, exceptions, provider errors or customer payloads.
export function checkOutput(e: ReleaseEvaluation) {
  if (!/^[a-f0-9]{40}$/.test(e.candidate.commitSha) || !Number.isInteger(e.policyVersion)) throw new Error("INVALID_CHECK_IDENTITY");
  const title = e.decision === "SHIP" ? "Release policy satisfied for the tested scope" : e.decision === "BLOCK" ? "BLOCKED: reproduced policy violation" : "ASSURANCE INCOMPLETE";
  const c = e.counts;
  const summary = [`Commit: ${e.candidate.commitSha}`, `Policy version: ${e.policyVersion}`, `Verified at: ${new Date(e.evaluatedAt).toISOString()}`,...(e.validUntil?[`Assurance expires: ${new Date(e.validUntil).toISOString()}`]:[]),
    `Required: ${c.requiredTotal}; applicable: ${c.applicableTotal}`, `PASS: ${c.PASS}; REPRODUCIBLE_FAILURE: ${c.REPRODUCIBLE_FAILURE}; INCONCLUSIVE: ${c.INCONCLUSIVE}`,
    `NOT_RUN: ${c.NOT_RUN}; STALE: ${c.STALE}; NOT_APPLICABLE: ${c.NOT_APPLICABLE}`, `Regressions passed: ${e.coverage.filter(c => c.kind === "REGRESSION" && c.status === "PASS").length}`,
    `Explicit exceptions applied: ${e.exceptions.length}`, ...e.findings.filter(f => f.blocking && /^[a-f0-9-]{36}$/.test(f.id)).map(f => `Blocking finding: ${f.id}`),
    ...e.coverage.filter(c=>c.status==="REPRODUCIBLE_FAILURE"&&/^[a-f0-9-]{36}$/.test(c.invariantId)&&["critical","high","medium","low"].includes(c.severity)).map(c=>`Reproduced invariant: ${c.invariantId}; severity: ${c.severity}`),
    e.decision === "SHIP" ? "This decision covers the tested release policy; it is not a claim of global security." : e.decision === "INCONCLUSIVE" ? "Required assurance is missing or unreliable. This is not a confirmed vulnerability." : "A reproduced failure violates this release policy."].join("\n");
  return {title,summary,conclusion:checkConclusion(e.decision)};
}
