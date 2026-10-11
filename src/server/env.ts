import "server-only";
import { z } from "zod";

export type ConfigurationState = "missing" | "placeholder" | "malformed" | "configured";
const secret = z.string().min(16).max(4096).regex(/^\S+$/);
const definitions = {
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().refine(v => {
    try { const url = new URL(v); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  ANTHROPIC_API_KEY: z.string().min(20).max(4096).regex(/^sk-ant-[A-Za-z0-9_-]+$/),
  ANTHROPIC_MODEL: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/),
  RAZORPAY_KEY_ID: z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]+$/),
  RAZORPAY_KEY_SECRET: secret,
  RAZORPAY_WEBHOOK_SECRET: secret,
  IP_HASH_SALT: z.string().min(32).max(512).regex(/^\S+$/),
} as const;
export type EnvironmentKey = keyof typeof definitions;
export type EnvironmentReport = Record<EnvironmentKey, ConfigurationState>;
const placeholder = /your[-_ ]|change[-_ ]?me|placeholder|example\.(com|org)|x{4,}|\.\.\.|<[^>]+>/i;

/** Returns states only. Input values and Zod errors never escape. */
export function inspectEnvironment(input: Record<string, string | undefined> = process.env): EnvironmentReport {
  return Object.fromEntries(Object.entries(definitions).map(([key, schema]) => {
    const value = input[key];
    const state: ConfigurationState = !value?.trim() ? "missing" : placeholder.test(value) ? "placeholder"
      : schema.safeParse(value).success ? "configured" : "malformed";
    return [key, state];
  })) as EnvironmentReport;
}
export function configuredValue(key: EnvironmentKey, input: Record<string, string | undefined> = process.env): string | undefined {
  return inspectEnvironment(input)[key] === "configured" ? input[key] : undefined;
}
export function configurationReadiness(input: Record<string, string | undefined> = process.env) {
  const state = inspectEnvironment(input);
  const all = (...keys: EnvironmentKey[]) => keys.every(k => state[k] === "configured");
  return {
    authentication: all("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    persistence: all("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"),
    analysis: all("ANTHROPIC_API_KEY") && ["missing", "configured"].includes(state.ANTHROPIC_MODEL),
    payments: all("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"),
    ipPrivacy: all("IP_HASH_SALT"),
  };
}
/** Aggregate only: configured is NOT connectivity or production readiness. */
export function publicHealth(input: Record<string, string | undefined> = process.env) {
  return {
    status: "ok" as const, service: "StartupX AI", version: "1.0.0", liveness: "alive" as const,
    configuration: Object.values(configurationReadiness(input)).every(Boolean) ? "configured" as const : "incomplete" as const,
    integrations: "not_probed" as const, productionReadiness: "not_assessed" as const,
    checks: {}, // Compatibility without public per-provider configuration flags.
  };
}
