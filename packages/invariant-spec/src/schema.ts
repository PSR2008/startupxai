import { z } from "zod";

export const identifierSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
export const domainSchema = z.enum([
  "tenant_isolation", "authorization", "paid_features", "billing", "webhooks",
  "ai_cost", "usage_concurrency", "authentication", "critical_flows", "release_safety",
]);
export const severitySchema = z.enum(["critical", "high", "medium", "low"]);
export const applicabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("APPLICABLE") }).strict(),
  z.object({ status: z.literal("UNDETERMINED"), reason: z.string().min(1).max(500) }).strict(),
  z.object({ status: z.literal("NOT_APPLICABLE"), reason: z.string().min(1).max(500), approvedBy: identifierSchema }).strict(),
]);
// Registry identifiers, never shell/JS/SQL/URLs. Later adapters own implementation.
export const operationSchema = z.enum([
  "resource.read", "resource.write", "role.change", "feature.invoke", "payment.observe",
  "webhook.deliver_test_event", "ai.invoke", "quota.concurrent_attempt", "session.check",
  "journey.execute_registered", "release.check_registered",
]);
const bindingSchema = z.object({ name: identifierSchema, fixtureRef: identifierSchema }).strict();
export const oracleSchema = z.object({
  id: identifierSchema,
  observation: identifierSchema,
  comparator: z.enum(["equals", "not_equals", "at_most"]),
  expected: z.union([z.boolean(), z.number().finite(), z.string().max(200)]),
}).strict().refine(o => o.comparator !== "at_most" || typeof o.expected === "number", "at_most requires a number");
export const invariantSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifierSchema,
  version: z.number().int().positive(),
  domain: domainSchema,
  statement: z.string().min(1).max(2000),
  applicability: applicabilitySchema,
  actors: z.array(bindingSchema).min(1).max(20),
  resources: z.array(bindingSchema).min(1).max(50),
  preconditions: z.array(identifierSchema).min(1).max(30),
  operation: z.object({
    kind: operationSchema,
    actor: identifierSchema,
    resource: identifierSchema,
    maxAttempts: z.number().int().min(1).max(100),
  }).strict(),
  assertions: z.array(oracleSchema).min(1).max(50),
  severity: severitySchema,
  provenance: z.object({
    source: z.enum(["human", "source_analysis", "model_proposal", "reference_lab"]),
    references: z.array(z.string().min(1).max(500)).min(1).max(50),
  }).strict(),
  confirmation: z.discriminatedUnion("status", [
    z.object({ status: z.literal("PROPOSED") }).strict(),
    z.object({ status: z.literal("CONFIRMED"), confirmedBy: identifierSchema, confirmedAt: z.string().datetime() }).strict(),
  ]),
}).strict().superRefine((spec, ctx) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(spec.actors.map(v => v.name)) || !unique(spec.resources.map(v => v.name)) ||
      !unique(spec.preconditions) || !unique(spec.assertions.map(v => v.id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate binding, precondition or assertion" });
  }
  if (!spec.actors.some(a => a.name === spec.operation.actor) || !spec.resources.some(r => r.name === spec.operation.resource)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Operation references an unbound actor/resource" });
  }
});
export type Invariant = z.infer<typeof invariantSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type Severity = z.infer<typeof severitySchema>;

// Documentation examples only. These do not represent verified applications.
export const invariantExamples: Invariant[] = [
  ["tenant.read", "tenant_isolation", "resource.read", "foreign_data_visible", false],
  ["member.role", "authorization", "role.change", "became_owner", false],
  ["payment.entitlement", "billing", "payment.observe", "failed_payment_grants", 0],
  ["ai.quota", "ai_cost", "ai.invoke", "over_quota_calls", 0],
].map(([id, domain, operation, observation, expected]) => invariantSchema.parse({
  schemaVersion: 1, id, version: 1, domain, statement: `Reference invariant: ${id}`,
  applicability: { status: "APPLICABLE" },
  actors: [{ name: "actor", fixtureRef: "synthetic.actor" }],
  resources: [{ name: "resource", fixtureRef: "synthetic.resource" }],
  preconditions: ["positive_control"],
  operation: { kind: operation, actor: "actor", resource: "resource", maxAttempts: 2 },
  assertions: [{ id: "assertion", observation, comparator: "equals", expected }],
  severity: "high", provenance: { source: "reference_lab", references: ["launchgate-reference-lab-v1"] },
  confirmation: { status: "CONFIRMED", confirmedBy: "reference-lab", confirmedAt: "2026-10-11T00:00:00.000Z" },
}));
