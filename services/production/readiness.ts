import { z } from "zod";
import { capabilityNames, capabilitySchema, environmentSchema, statusSchema, type CapabilityStatus } from "./contracts";
const qualificationSchema = z.object({ capability: capabilitySchema, environment: environmentSchema, status: statusSchema, evidenceDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(), observedAt: z.number().finite(), expiresAt: z.number().finite(), live: z.boolean() }).strict();
export type Qualification = z.infer<typeof qualificationSchema>;
/** Records are loaded exclusively through the trusted operations service, never request JSON. */
export function capabilityRegistry(environment: z.infer<typeof environmentSchema>, records: Qualification[], now = Date.now()) {
  return Object.fromEntries(capabilityNames.map(name => {
    const candidates = records.map(x => qualificationSchema.parse(x)).filter(x => x.environment === environment && x.capability === name && x.observedAt <= now).sort((a,b) => b.observedAt-a.observedAt || Number(a.status==="VERIFIED")-Number(b.status==="VERIFIED"));
    const record = candidates[0]; let status: CapabilityStatus = record?.status ?? (name === "sandbox.production" ? "BLOCKED_BY_ENVIRONMENT" : "UNVERIFIED");
    if (record && (record.expiresAt <= now || record.expiresAt <= record.observedAt || record.expiresAt-record.observedAt>86400000 || status === "VERIFIED" && (!record.live || !record.evidenceDigest))) status = "UNVERIFIED";
    return [name, status];
  })) as Record<typeof capabilityNames[number], CapabilityStatus>;
}
export const productionConfigSchema = z.object({ environment: environmentSchema, sandbox: z.enum(["production", "local-test", "none"]), secrets: z.enum(["managed", "local-test", "none"]), artifacts: z.enum(["managed", "local-test", "none"]), privateArtifacts: z.boolean(), encryption: z.boolean(), signingKeyConfigured: z.boolean(), githubSecret: z.string().min(16), unrestrictedEgress: z.literal(false), paymentMode: z.literal("TEST_ONLY"), resourceEnvironment: environmentSchema }).strict().superRefine((c, ctx) => {
  if (c.environment !== c.resourceEnvironment || /placeholder|change.?me|your[_-]|example/i.test(c.githubSecret)) ctx.addIssue({code:"custom",message:"ENVIRONMENT_CONFIGURATION"});
  if (["production", "staging"].includes(c.environment) && (c.sandbox !== "production" || c.secrets !== "managed" || c.artifacts !== "managed" || !c.privateArtifacts || !c.encryption || !c.signingKeyConfigured)) ctx.addIssue({code:"custom",message:"PRODUCTION_CONFIGURATION"});
});
export type ProductionConfig = z.infer<typeof productionConfigSchema>;
export function readiness(config: unknown, records: Qualification[], now = Date.now()) {
  const parsed = productionConfigSchema.safeParse(config);
  const environment = parsed.success ? parsed.data.environment : "production";
  const integrations = capabilityRegistry(environment, records, now);
  const required = ["sandbox.production", "secrets.managed", "artifacts.private", "supabase.hosted", "github.live", "vercel.live", "staging.e2e"] as const;
  return { liveness: "ALIVE" as const, configuration: parsed.success ? "CONFIGURED" as const : "INVALID" as const, integrations, productionReady: parsed.success && required.every(name => integrations[name] === "VERIFIED") };
}
export function publicReadiness(result: ReturnType<typeof readiness>) { return { liveness: result.liveness, configuration: result.configuration, integrationVerification: result.productionReady ? "VERIFIED" : "INCOMPLETE", productionReady: result.productionReady }; }
