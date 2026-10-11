import { z } from "zod";
import { domainSchema, identifierSchema, oracleSchema } from "@launchgate/invariant-spec";

export const fixtureFamilies = ["tenant_isolation", "privilege_escalation", "paid_feature_bypass",
  "payment_entitlement_integrity", "webhook_duplicate_replay", "ai_quota_cost_bypass",
  "distributed_usage_enforcement", "auth_session_boundaries"] as const;
export const referenceFixtureSchema = z.object({
  family: z.enum(fixtureFamilies), domain: domainSchema,
  version: z.number().int().positive(), seed: identifierSchema,
  setupRequirements: z.array(identifierSchema).min(1).max(30),
  oracle: oracleSchema,
  variants: z.object({
    vulnerable: z.object({ identity: identifierSchema, expectedOutcome: z.literal("REPRODUCIBLE_FAILURE") }).strict(),
    fixed: z.object({ identity: identifierSchema, expectedOutcome: z.literal("PASS") }).strict(),
    inconclusive: z.object({ identity: identifierSchema, expectedOutcome: z.literal("INCONCLUSIVE") }).strict(),
  }).strict(),
}).strict().refine(f => new Set(Object.values(f.variants).map(v => v.identity)).size === 3, "Fixture variants must be distinct");
export type ReferenceFixture = z.infer<typeof referenceFixtureSchema>;
