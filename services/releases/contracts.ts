import { z } from "zod";
import { candidateSchema, digestSchema } from "@launchgate/contracts";
import { identifierSchema as id, invariantSchema, severitySchema } from "@launchgate/invariant-spec";

export const releaseStates = ["DISCOVERED", "WAITING_FOR_DEPLOYMENT", "READY", "VERIFYING", "EVALUATING", "DECIDED", "SUPERSEDED", "CANCELLED"] as const;
export const releaseSchema = z.object({
  id, candidate: candidateSchema, repositoryConnectionId: id.nullable(), snapshotId: id.nullable(),
  provider: z.enum(["VERCEL", "REFERENCE_LAB"]), providerDeploymentId: id,
  deploymentCommitSha: z.string().regex(/^[a-f0-9]{40}$/), environmentId: id,
  environment: z.enum(["SANDBOX", "PREVIEW", "STAGING"]), invariantSetDigest: digestSchema,
  requestedBy: id, createdAt: z.string().datetime(),
  baseSha: z.string().regex(/^[a-f0-9]{40}$/).nullable(), headSha: z.string().regex(/^[a-f0-9]{40}$/),
  pullRequest: z.number().int().positive().nullable(), branch: z.string().max(255).nullable(),
}).strict().superRefine((r, ctx) => {
  if (r.candidate.purpose === "CUSTOMER_VERIFICATION" && (!r.repositoryConnectionId || !r.snapshotId || r.provider !== "VERCEL"))
    ctx.addIssue({ code: "custom", message: "Customer release requires repository, snapshot and provider identity" });
  if (r.candidate.purpose === "REFERENCE_LAB" && r.provider !== "REFERENCE_LAB")
    ctx.addIssue({ code: "custom", message: "Lab identity cannot represent a customer deployment" });
});
export const requirementSchema = z.object({
  invariant: invariantSchema, required: z.boolean(), baseline: z.boolean(),
  kind: z.enum(["INVARIANT", "JOURNEY", "REGRESSION"]), family: id,
  runnerVersion: id, testVersion: id, fixtureVersion: z.number().int().positive(), planHash: digestSchema,
  estimatedCost: z.number().finite().nonnegative(),
  applicabilityProof: z.object({ snapshotId: id.nullable(), commitSha: z.string().regex(/^[a-f0-9]{40}$/), digest: digestSchema }).strict().nullable(),
}).strict();
export const releasePolicySchema = z.object({
  id, version: z.number().int().positive(), blockingSeverities: z.array(severitySchema).max(4),
  requiredFamilies: z.array(id).min(1).max(100), requirements: z.array(requirementSchema).min(1).max(1000),
  freshnessSeconds: z.number().int().min(1).max(2592000),
  environments: z.array(z.enum(["SANDBOX", "PREVIEW", "STAGING"])).min(1).max(3),
  minimumCoverage: z.literal(1), requiredInconclusive: z.literal("NON_APPROVAL"),
  allowExceptions: z.boolean(), maximumExceptionSeconds: z.number().int().min(1).max(2592000),
}).strict().superRefine((p, ctx) => {
  if (new Set(p.requirements.map(r => r.invariant.id)).size !== p.requirements.length)
    ctx.addIssue({ code: "custom", message: "Duplicate requirement" });
  for (const family of p.requiredFamilies) if (!p.requirements.some(r => r.required && r.family === family))
    ctx.addIssue({ code: "custom", message: "Missing required family" });
});
export const exceptionSchema = z.object({
  id, organizationId: id, projectId: id, releaseId: id, policyId: id, policyVersion: z.number().int().positive(),
  invariantId: id, findingId: id.nullable(), reason: z.string().trim().min(1).max(1000),
  actorId: id, actorRole: z.enum(["OWNER", "ADMIN"]), createdAt: z.string().datetime(), expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(), ticket: z.string().max(500).nullable(),
}).strict();
export type Release = z.infer<typeof releaseSchema>;
export type ReleasePolicy = z.infer<typeof releasePolicySchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export type PolicyException = z.infer<typeof exceptionSchema>;
