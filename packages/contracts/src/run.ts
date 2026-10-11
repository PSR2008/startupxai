import { z } from "zod";
import { identifierSchema } from "@launchgate/invariant-spec";

export const candidateSchema = z.object({
  organizationId: identifierSchema,
  projectId: identifierSchema,
  commitSha: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  deploymentId: identifierSchema,
  policyId: identifierSchema,
  policyVersion: z.number().int().positive(),
  evidenceScope: identifierSchema,
  purpose: z.enum(["CUSTOMER_VERIFICATION", "REFERENCE_LAB"]),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const scopeSchema = candidateSchema.extend({
  invariantId: identifierSchema,
  invariantVersion: z.number().int().positive(),
});
export type Scope = z.infer<typeof scopeSchema>;
export const runSchema = z.object({
  id: identifierSchema, candidate: candidateSchema,
  state: z.enum(["QUEUED", "PREPARING", "RUNNING", "CANCELLING", "COMPLETED", "CANCELLED", "ERROR"]),
  authorizationId: identifierSchema,
  createdAt: z.string().datetime(),
  idempotencyKey: identifierSchema,
}).strict();
export function sameCandidate(a: Candidate, b: Candidate): boolean {
  return (Object.keys(candidateSchema.shape) as (keyof Candidate)[]).every(key => a[key] === b[key]);
}
