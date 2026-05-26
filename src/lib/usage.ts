/**
 * src/lib/usage.ts
 * ─────────────────────────────────────────────────────────────
 * NEW FILE — create at src/lib/usage.ts
 *
 * Server-side helpers for:
 *   - logUsage()         — writes one row to usage_logs (non-blocking)
 *   - getUsageSummary()  — returns plan + monthly usage counts
 *
 * Phase 2: TRACKING ONLY — no hard limits enforced.
 * Uses the existing getSupabaseAdminClient() from src/lib/supabase.ts
 * ─────────────────────────────────────────────────────────────
 */
import { getSupabaseAdminClient } from "./supabase";
import { PLANS, type PlanKey } from "./plans";

// ── Constants ──────────────────────────────────────────────────

const MONTHLY_LIMITS: Record<PlanKey, number> = {
  free:    PLANS.free.analysesPerMonth,    // 15
  founder: PLANS.founder.analysesPerMonth, // 500
};

// ── Types ──────────────────────────────────────────────────────

export interface UsageSummary {
  plan: PlanKey;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  expires_at: string | null;
}

// ── logUsage ───────────────────────────────────────────────────

/**
 * Writes one usage_logs row after a successful engine analysis.
 *
 * Call pattern in engine routes (after successful result):
 *   import { logUsage } from "@/lib/usage";
 *   await logUsage(userId, "idea");
 *
 * - Non-blocking: never throws or rejects
 * - Requires SUPABASE_SERVICE_ROLE_KEY env var
 * - user_id is optional: if null/empty, the row is skipped silently
 */
export async function logUsage(
  userId: string | null | undefined,
  engineName: string
): Promise<void> {
  if (!userId) return; // anonymous request — skip silently

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return; // admin client not configured — skip silently

    const { error } = await admin.from("usage_logs").insert({
      user_id:     userId,
      engine_name: engineName,
    });

    if (error) {
      // Non-fatal — log but never surface to user
      console.error(`[logUsage] insert failed (${engineName}):`, error.message);
    }
  } catch (err) {
    console.error(`[logUsage] unexpected error (${engineName}):`, err);
  }
}

// ── getUsageSummary ────────────────────────────────────────────

/**
 * Returns the user's plan + monthly usage counts for the dashboard.
 *
 * - Uses calendar-month window (1st of current month → now)
 * - Falls back to Free plan defaults on any DB error
 * - Never throws
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const FREE_DEFAULTS: UsageSummary = {
    plan:                "free",
    billing_cycle:       null,
    monthly_limit:       MONTHLY_LIMITS.free,
    analyses_used:       0,
    analyses_remaining:  MONTHLY_LIMITS.free,
    expires_at:          null,
  };

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return FREE_DEFAULTS;

    // ── 1. Fetch plan row ──────────────────────────────────────
    const { data: planRow } = await admin
      .from("user_plans")
      .select("plan, billing_cycle, active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    // Resolve effective plan (check expiry)
    let effectivePlan: PlanKey = "free";
    let billingCycle: string | null = null;
    let expiresAt: string | null = null;

    if (planRow && planRow.active) {
      const expired =
        planRow.expires_at != null &&
        new Date(planRow.expires_at) < new Date();

      if (!expired) {
        effectivePlan = (planRow.plan as PlanKey) ?? "free";
        billingCycle  = planRow.billing_cycle ?? null;
        expiresAt     = planRow.expires_at    ?? null;
      }
    }

    const monthlyLimit = MONTHLY_LIMITS[effectivePlan] ?? MONTHLY_LIMITS.free;

    // ── 2. Count this month's analyses ────────────────────────
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error: countError } = await admin
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart);

    if (countError) {
      console.error("[getUsageSummary] count error:", countError.message);
      // Return plan info but zero counts on DB error
      return {
        plan:                effectivePlan,
        billing_cycle:       billingCycle,
        monthly_limit:       monthlyLimit,
        analyses_used:       0,
        analyses_remaining:  monthlyLimit,
        expires_at:          expiresAt,
      };
    }

    const used      = count ?? 0;
    const remaining = Math.max(0, monthlyLimit - used);

    return {
      plan:                effectivePlan,
      billing_cycle:       billingCycle,
      monthly_limit:       monthlyLimit,
      analyses_used:       used,
      analyses_remaining:  remaining,
      expires_at:          expiresAt,
    };
  } catch (err) {
    console.error("[getUsageSummary] unexpected error:", err);
    return FREE_DEFAULTS;
  }
}
