import "server-only";
import { createHash, createPrivateKey } from "node:crypto";
import { z } from "zod";
export type ConfigurationAvailability = "CONFIGURED" | "MISSING" | "PLACEHOLDER" | "MALFORMED";
const secret = (v: string) => /^\S{16,4096}$/.test(v);
const https = (v: string) => { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash; };
const rsa = (v: string) => { const k = createPrivateKey(v.replaceAll("\\n", "\n")); return k.asymmetricKeyType === "rsa" && (k.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048; };
const definitions: Record<string, (v: string) => boolean> = {
  LAUNCHGATE_GITHUB_APP_ID: v => /^[1-9]\d*$/.test(v), LAUNCHGATE_GITHUB_CLIENT_ID: v => /^[A-Za-z0-9_.-]{5,100}$/.test(v),
  LAUNCHGATE_GITHUB_CLIENT_SECRET: secret, LAUNCHGATE_GITHUB_PRIVATE_KEY: rsa, LAUNCHGATE_GITHUB_WEBHOOK_SECRET: v => secret(v) && v.length >= 32, LAUNCHGATE_GITHUB_REDIRECT_URI: https,
  LAUNCHGATE_REMEDIATION_APP_ID: v => /^[1-9]\d*$/.test(v), LAUNCHGATE_REMEDIATION_PRIVATE_KEY: rsa,
  LAUNCHGATE_VERCEL_CONNECTIONS: v => z.array(z.object({
    projectId: z.string().uuid(), organizationId: z.string().uuid(), credentialReference: z.string().uuid(),
    accountId: z.string().regex(/^team_[A-Za-z0-9]+$/), providerProjectId: z.string().regex(/^prj_[A-Za-z0-9]+$/),
    token: z.string().min(20).max(512),
  }).strict()).min(1).max(100).safeParse(JSON.parse(v)).success,
  NEXT_PUBLIC_SUPABASE_URL: https, NEXT_PUBLIC_SUPABASE_ANON_KEY: secret, SUPABASE_SERVICE_ROLE_KEY: secret,
  STRIPE_SECRET_KEY: v => /^sk_test_[A-Za-z0-9]+$/.test(v), STRIPE_WEBHOOK_SECRET: v => /^whsec_\S{16,}$/.test(v),
  RAZORPAY_KEY_ID: v => /^rzp_test_[A-Za-z0-9]+$/.test(v), RAZORPAY_KEY_SECRET: secret, RAZORPAY_WEBHOOK_SECRET: secret,
  OPENAI_API_KEY: v => /^sk-\S{16,}$/.test(v), ANTHROPIC_API_KEY: v => /^sk-ant-\S{16,}$/.test(v),
  LAUNCHGATE_ARTIFACT_BACKEND: v => v === "managed", LAUNCHGATE_SECRET_BACKEND: v => v === "managed", LAUNCHGATE_SANDBOX_BACKEND: v => v === "production",
  LAUNCHGATE_ENVIRONMENT: v => v === "staging", LAUNCHGATE_RESOURCE_ENVIRONMENT: v => v === "staging",
};
export function configurationInventory(env: Record<string, string | undefined> = process.env): Record<string, ConfigurationAvailability> {
  return Object.fromEntries(Object.entries(definitions).map(([key, validate]) => {
    const value = env[key]; let state: ConfigurationAvailability = "MISSING";
    if (value?.trim()) {
      state = "PLACEHOLDER";
      if (!/your[-_ ]|change[-_ ]?me|placeholder|example\.(com|org)|x{4,}|\.\.\.|<[^>]+>/i.test(value)) {
        try { state = validate(value) ? "CONFIGURED" : "MALFORMED"; } catch { state = "MALFORMED"; }
      }
    }
    return [key, state];
  }));
}
/** Server-only binding: rotations/config changes invalidate records automatically.
 * Never returned in browser readiness responses or printed by inventory. */
export function runtimeConfigurationDigest(env: Record<string, string | undefined> = process.env) {
  const names = [...new Set([...Object.keys(definitions), ...Object.keys(env).filter(k => k.startsWith("LAUNCHGATE_"))])].sort();
  return "sha256:" + createHash("sha256").update(JSON.stringify(names.map(name => [name, env[name] ?? null]))).digest("hex");
}
