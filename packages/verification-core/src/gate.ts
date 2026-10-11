import { z } from "zod";
import { candidateSchema, sameCandidate, type Candidate, type EvidenceAdmission } from "@launchgate/contracts";
import { identifierSchema, invariantSchema, severitySchema } from "@launchgate/invariant-spec";
import { evaluateOutcome, type Evaluation } from "./outcomes";

export const gatePolicySchema = z.object({
  id: identifierSchema, version: z.number().int().positive(),
  blockingSeverities: z.array(severitySchema).max(4),
  requirements: z.array(z.object({ invariant: invariantSchema, required: z.boolean() }).strict()).min(1).max(1000),
}).strict().refine(p => new Set(p.requirements.map(r => r.invariant.id)).size === p.requirements.length, "Duplicate invariant policy entry");
export type GatePolicy = z.infer<typeof gatePolicySchema>;
export interface GateSubmission { invariantId: string; evidence: unknown; admission: EvidenceAdmission }
export interface GateDecision {
  decision: "SHIP" | "BLOCK" | "INCONCLUSIVE";
  reason: string;
  candidate?: Candidate;
  results: Array<Evaluation & { invariantId: string }>;
  notApplicable: string[];
}
// Never accepts a supplied PASS/FAIL verdict. Every submission is reevaluated.
export function evaluateGate(candidateInput: unknown, policyInput: unknown, submissions: readonly GateSubmission[]): GateDecision {
  const c = candidateSchema.safeParse(candidateInput);
  const p = gatePolicySchema.safeParse(policyInput);
  const invalid: GateDecision = { decision: "INCONCLUSIVE", reason: "INVALID_CANDIDATE_OR_POLICY", results: [], notApplicable: [] };
  if (!c.success || !p.success || c.data.policyId !== p.data.id || c.data.policyVersion !== p.data.version) return invalid;
  const candidate = c.data, policy = p.data;
  const results: GateDecision["results"] = [], notApplicable: string[] = [];
  let blocked = false, incomplete = false, requiredApplicable = 0;
  for (const requirement of policy.requirements) {
    const spec = requirement.invariant;
    if (spec.applicability.status === "NOT_APPLICABLE" && spec.confirmation.status === "CONFIRMED") {
      notApplicable.push(spec.id);
      continue;
    }
    if (requirement.required) requiredApplicable++;
    const matching = submissions.filter(s => s.invariantId === spec.id);
    let result = matching.length === 1
      ? evaluateOutcome(spec, matching[0].evidence, matching[0].admission)
      : { outcome: "INCONCLUSIVE" as const, applicability: spec.applicability.status, reason: "MISSING_OR_AMBIGUOUS_COVERAGE" };
    if (result.scope && !sameCandidate(result.scope, candidate)) {
      result = { ...result, outcome: "INCONCLUSIVE", reason: "CANDIDATE_MISMATCH" };
    }
    results.push({ ...result, invariantId: spec.id });
    if (result.outcome === "REPRODUCIBLE_FAILURE" && policy.blockingSeverities.includes(spec.severity)) blocked = true;
    if (requirement.required && result.outcome !== "PASS") incomplete = true;
  }
  const decision = blocked ? "BLOCK" : incomplete || requiredApplicable === 0 ? "INCONCLUSIVE" : "SHIP";
  return { decision, candidate, results, notApplicable,
    reason: blocked ? "REPRODUCED_POLICY_VIOLATION" : decision === "SHIP" ? "REQUIRED_SCOPE_PASSED" : "REQUIRED_ASSURANCE_INCOMPLETE" };
}
