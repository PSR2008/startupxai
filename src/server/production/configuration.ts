import "server-only";
import { createPrivateKey } from "node:crypto";
import { environmentSchema, capabilityNames } from "../../../services/production/contracts";
import { productionConfigSchema, readiness, type Qualification } from "../../../services/production/readiness";
export function executionEnvironment(env: Record<string,string|undefined> = process.env) {
  return environmentSchema.parse(env.LAUNCHGATE_ENVIRONMENT ?? (env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development"));
}
export function requireLocalEnvironment(env: Record<string,string|undefined> = process.env) {
  if (!["development", "test"].includes(executionEnvironment(env))) throw new Error("LOCAL_PROVIDER_IN_PRODUCTION");
}
export function productionConfiguration(env: Record<string,string|undefined> = process.env) {
  let signingKeyConfigured=false;
  try { signingKeyConfigured=createPrivateKey((env.LAUNCHGATE_RUNNER_PRIVATE_KEY??"").replaceAll("\\n","\n")).asymmetricKeyType==="ed25519"; } catch { /* No key material or parser errors leave this boundary. */ }
  return productionConfigSchema.parse({ environment: executionEnvironment(env), resourceEnvironment: env.LAUNCHGATE_RESOURCE_ENVIRONMENT,
    sandbox: env.LAUNCHGATE_SANDBOX_BACKEND ?? "none", secrets: env.LAUNCHGATE_SECRET_BACKEND ?? "none", artifacts: env.LAUNCHGATE_ARTIFACT_BACKEND ?? "none",
    privateArtifacts: env.LAUNCHGATE_ARTIFACT_PRIVATE === "1", encryption: env.LAUNCHGATE_ARTIFACT_ENCRYPTION === "PROVIDER_KMS", signingKeyConfigured,
    githubSecret: env.LAUNCHGATE_GITHUB_WEBHOOK_SECRET, unrestrictedEgress: env.LAUNCHGATE_UNRESTRICTED_EGRESS !== undefined && env.LAUNCHGATE_UNRESTRICTED_EGRESS !== "0", paymentMode: env.LAUNCHGATE_VERIFICATION_PAYMENT_MODE });
}
/** Presence is configuration only. This function does no network requests. */
export function localQualificationReport() {
  const records: Qualification[] = [];
  return { capabilities: Object.fromEntries(capabilityNames.map(name => [name, name === "sandbox.production" ? "BLOCKED_BY_ENVIRONMENT" : "UNVERIFIED"])), readiness: readiness({}, records), customerCodeExecution: "DISABLED" };
}
