import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { CapabilityStatus, OperationsStore } from "./contracts";

/** This catalog is also the required evidence checklist, not a list of mock successes. */
export const qualificationChecks = {
  "github.live": ["installation", "read_permissions", "exact_sha_snapshot", "signed_webhook", "delivery_dedupe", "source_discovery", "revocation"],
  "github.checks.live": ["ship_success", "block_failure", "inconclusive_nonapproval", "exact_sha", "supersession", "idempotency"],
  "github.remediation.live": ["explicit_approval", "separate_write_authority", "fix_branch", "commit", "pull_request", "no_merge", "revocation", "read_without_write"],
  "vercel.live": ["ownership", "immutable_deployment", "exact_sha", "preview_only", "redirect_denial", "credential_stripping", "supersession"],
  "supabase.hosted": ["migration_chain", "rls", "real_auth_session", "service_isolation", "tenant_isolation", "audit", "reconnection", "upgrade", "generated_types"],
  "artifact_store.managed": ["private_default", "scoped_upload", "hash", "authorized_read", "signed_read", "expiry", "delete", "cross_org_denial", "retention"],
  "secret_store.managed": ["put", "lease", "use", "rotate", "revoke", "delete", "metadata_only", "redaction"],
  "sandbox.production": ["ephemeral", "no_control_secrets", "no_docker_socket", "metadata_denied", "resource_limits", "time_limits", "egress_allowlist", "redirect_denial", "target_scope", "filesystem_isolation", "terminate", "destroy", "cross_run_isolation", "stale_grant", "crash_cleanup"],
  "stripe.test": ["test_mode", "amount_currency", "success", "failure", "signature", "duplicate", "replay", "cancel", "refund", "zero_live_spend"],
  "razorpay.test": ["test_mode", "order", "amount_currency", "payment_verification", "capture_state", "signature", "duplicate", "replay", "zero_live_spend"],
  "openai.live": ["credential_resolution", "request", "timeout", "redaction", "model", "usage", "reservation_before_call", "error_handling", "budget_bound"],
  "anthropic.live": ["credential_resolution", "request", "timeout", "redaction", "model", "usage", "reservation_before_call", "error_handling", "budget_bound"],
  "staging.full_e2e": ["source", "discovery", "confirmation", "preview", "authorization", "reproduced_block", "approved_fix", "new_preview", "exact_replay", "regression", "ship", "github_check"],
  "staging.deployment": ["separate_database", "separate_secrets", "separate_artifacts", "separate_signing", "test_credentials", "https", "exact_sha"],
  "staging.recovery": ["interruption", "stale_reservation", "expired_credential", "orphan_cleanup", "runner_disappearance"],
  "staging.cleanup": ["containers", "volumes", "identities", "leases", "reservations", "sandboxes", "artifacts"],
  "cli.windows.staging": ["login", "whoami", "init", "inspect", "ship", "block", "inconclusive", "json", "logout"],
  "github.action.live": ["actual_workflow", "scoped_credential", "exact_sha", "masking", "summary", "ship", "block", "inconclusive"],
  "assessment.external": ["owned_public_repo", "canonical_identity", "immutable_cache", "static_analysis", "rate_controls", "disclaimer", "conversion"],
  "sharing.external": ["explicit_share", "unauthenticated_read", "revoke", "denial", "verified", "supersession_stale", "new_verified", "private_undiscoverable"],
} as const;
export const qualificationNames = Object.keys(qualificationChecks) as (keyof typeof qualificationChecks)[];
export type QualificationName = keyof typeof qualificationChecks;
const httpsOrigin = (host: RegExp) => z.string().url().refine(v => {
  try { const u = new URL(v); return u.protocol === "https:" && !u.port && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash && host.test(u.hostname); }
  catch { return false; }
});
/** Operator-owned metadata only. Never accepts credentials, arbitrary endpoints or code. */
export const stagingManifestSchema = z.object({
  schemaVersion: z.literal(1), environment: z.literal("staging"), dedicated: z.literal(true),
  organizationId: z.string().uuid(), projectId: z.string().uuid(),
  stagingOrigin: httpsOrigin(/^[a-z0-9-]+\.vercel\.app$/),
  supabaseOrigin: httpsOrigin(/^[a-z0-9-]+\.supabase\.co$/),
  repositoryId: z.number().int().positive().safe(), repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  vercelProjectId: z.string().regex(/^prj_[A-Za-z0-9]+$/),
  artifactNamespace: z.string().regex(/^launchgate-staging-[a-z0-9-]+$/),
  secretNamespace: z.string().regex(/^launchgate-staging-[a-z0-9-]+$/),
  configurationRevision: z.string().uuid(), credentialRevision: z.string().uuid(),
  permissionRevision: z.string().uuid(), sandboxVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
  approvedCapabilities: z.array(z.enum(qualificationNames as [QualificationName, ...QualificationName[]])).max(20),
  allowTestPullRequest: z.boolean().default(false), paymentMode: z.literal("TEST_ONLY"),
}).strict();
export type StagingManifest = z.infer<typeof stagingManifestSchema>;
export function configurationDigest(manifest: StagingManifest) {
  const parsed = stagingManifestSchema.parse(manifest);
  return "sha256:" + createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
}
export type SafeReason = "ASSETS_MISSING" | "CONFIGURATION_INVALID" | "NOT_APPROVED" | "DRIVER_UNAVAILABLE" | "CONTRACT_ONLY" | "CHECKS_INCOMPLETE" | "LIVE_CHECKS_PASSED" | "PROVIDER_FAILURE" | "CLEANUP_FAILED" | "CONFIGURATION_CHANGED" | "BUDGET_UNBOUNDED";
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const observationSchema = z.object({
  environment: z.literal("staging"), organizationId: z.string().uuid(), projectId: z.string().uuid(),
  configurationDigest: digest, live: z.boolean(), checks: z.record(z.enum(["PASS", "FAIL", "UNAVAILABLE"])),
  evidenceDigest: digest, cleanupComplete: z.boolean(),
}).strict();
export interface QualificationDriver {
  /** Registered by trusted operator code, never selected from request JSON or a repository. */
  readonly kind: "live" | "contract";
  exercise(manifest: StagingManifest, signal: AbortSignal): Promise<z.infer<typeof observationSchema>>;
  cleanup(manifest: StagingManifest): Promise<boolean>;
}
export interface QualificationResult {
  capability: QualificationName; environment: "staging"; status: CapabilityStatus;
  live: boolean; evidenceDigest: string | null; configurationDigest: string | null;
  reason: SafeReason; testedAt: string; expiresAt: string;
}
export async function qualify(capability: QualificationName, input: unknown, driver?: QualificationDriver, now = Date.now(), diagnostic?: { store: OperationsStore; ceilingMicroUsd: number; pricingExpiresAt: number }): Promise<QualificationResult> {
  const result: QualificationResult = { capability, environment: "staging", status: "BLOCKED_BY_ENVIRONMENT", live: false, evidenceDigest: null, configurationDigest: null, reason: "ASSETS_MISSING", testedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString() };
  if (!qualificationNames.includes(capability)) throw new Error("UNKNOWN_CAPABILITY");
  if (input === undefined) return capability === "github.remediation.live" ? { ...result, status: "UNVERIFIED" } : result;
  const parsed = stagingManifestSchema.safeParse(input);
  if (!parsed.success) return { ...result, reason: "CONFIGURATION_INVALID" };
  const manifest = parsed.data;
  result.configurationDigest = configurationDigest(manifest);
  if (!manifest.approvedCapabilities.includes(capability) || capability === "github.remediation.live" && !manifest.allowTestPullRequest) return { ...result, reason: "NOT_APPROVED" };
  if (!driver) return { ...result, status: "NOT_IMPLEMENTED", reason: "DRIVER_UNAVAILABLE" };
  if (capability === "openai.live" || capability === "anthropic.live") {
    if (!diagnostic || !Number.isSafeInteger(diagnostic.ceilingMicroUsd) || diagnostic.ceilingMicroUsd < 1 || diagnostic.ceilingMicroUsd > 100000 || !Number.isFinite(diagnostic.pricingExpiresAt) || diagnostic.pricingExpiresAt <= now || diagnostic.pricingExpiresAt > now + 86400000) return { ...result, reason: "BUDGET_UNBOUNDED" };
    try {
      await diagnostic.store.command("QUALIFICATION_BUDGET", { id: randomUUID(), organizationId: manifest.organizationId, environment: "staging", provider: capability.split(".")[0], reservedMicroUsd: diagnostic.ceilingMicroUsd });
    } catch { return { ...result, reason: "BUDGET_UNBOUNDED" }; }
  }
  let cleanup = false;
  try {
    const observed = observationSchema.parse(await driver.exercise(manifest, AbortSignal.timeout(900000)));
    if (observed.organizationId !== manifest.organizationId || observed.projectId !== manifest.projectId || observed.configurationDigest !== result.configurationDigest) throw new Error("OBSERVATION_BINDING");
    const complete = qualificationChecks[capability].every(check => observed.checks[check] === "PASS");
    result.status = complete && observed.live && driver.kind === "live" && observed.cleanupComplete ? "VERIFIED" : "UNVERIFIED";
    result.live = result.status === "VERIFIED"; result.evidenceDigest = observed.evidenceDigest;
    result.reason = driver.kind !== "live" || !observed.live ? "CONTRACT_ONLY" : complete && observed.cleanupComplete ? "LIVE_CHECKS_PASSED" : "CHECKS_INCOMPLETE";
  } catch { result.status = "DEGRADED"; result.reason = "PROVIDER_FAILURE"; }
  finally { try { cleanup = await driver.cleanup(manifest); } catch { /* Provider messages may contain credentials. */ } }
  if (!cleanup) { result.status = "DEGRADED"; result.reason = "CLEANUP_FAILED"; result.live = false; }
  // A driver cannot consume its entire evidence TTL and still publish fresh verification.
  if (Date.now() >= Date.parse(result.expiresAt)) { result.status = "UNVERIFIED"; result.live = false; result.reason = "CHECKS_INCOMPLETE"; }
  return result;
}
export async function persistQualification(store: OperationsStore, organizationId: string, result: QualificationResult, runtimeDigest?: string) {
  z.string().uuid().parse(organizationId);
  if (result.status === "VERIFIED") digest.parse(runtimeDigest);
  await store.command("QUALIFY", { organizationId, ...result, runtimeDigest: runtimeDigest ?? null });
}

export const minimumLiveQualifications: QualificationName[] = ["github.live", "github.checks.live", "supabase.hosted", "vercel.live", "staging.deployment", "artifact_store.managed", "secret_store.managed", "sandbox.production", "staging.full_e2e", "staging.recovery", "staging.cleanup"];
export function launchPolicy(statuses: Partial<Record<QualificationName, CapabilityStatus>>, features: ("stripe" | "razorpay" | "openai" | "anthropic")[] = []) {
  const required = [...minimumLiveQualifications, ...features.map(name => `${name}.${name === "stripe" || name === "razorpay" ? "test" : "live"}` as QualificationName)];
  const missing = required.filter(name => statuses[name] !== "VERIFIED");
  return { productionReady: missing.length === 0, required, missing };
}
