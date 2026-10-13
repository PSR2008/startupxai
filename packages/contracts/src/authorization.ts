import { z } from "zod";
import { identifierSchema, operationSchema } from "@launchgate/invariant-spec";

const host = z.string().max(253).regex(/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
export const targetAuthorizationSchema = z.object({
  id: identifierSchema, organizationId: identifierSchema, projectId: identifierSchema,
  targetHost: host,
  method: z.enum(["DEPLOYMENT_CHALLENGE", "PROVIDER_OWNERSHIP_VERIFICATION", "REFERENCE_LAB_HARNESS"]),
  proofReference: identifierSchema,
  authorizingPrincipal: z.object({ userId: identifierSchema, origin: z.literal("supabase_verified_bearer") }).strict(),
  allowedHosts: z.array(host).min(1).max(20),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).min(1).max(10),
  allowedOperations: z.array(operationSchema).min(1).max(20),
  startsAt: z.string().datetime(), expiresAt: z.string().datetime(),
  requestLimit: z.number().int().positive().max(10000),
  requestsPerSecond: z.number().positive().max(100),
  concurrencyLimit: z.number().int().positive().max(10),
  spendLimit: z.object({ currency: z.literal("USD"), micros: z.number().int().nonnegative().max(100_000_000) }).strict(),
  revocation: z.discriminatedUnion("state", [
    z.object({ state: z.literal("ACTIVE") }).strict(),
    z.object({ state: z.literal("REVOKED"), revokedAt: z.string().datetime() }).strict(),
  ]),
}).strict().refine(a => a.allowedHosts.includes(a.targetHost), "Target must be allowlisted")
  .refine(a => Date.parse(a.expiresAt) > Date.parse(a.startsAt), "Authorization window is invalid");
export type TargetAuthorization = z.infer<typeof targetAuthorizationSchema>;
// Structural validation is not proof of authority, public IP safety, or current validity.
