import { getSupabaseAdminClient } from "./supabase";
import { PLANS, type PlanKey } from "./plans";

const MONTHLY_LIMITS: Record<PlanKey, number> = {
  free: PLANS.free.analysesPerMonth,
  founder: PLANS.founder.analysesPerMonth,
};

export interface UsageSummary {
  plan: PlanKey;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  expires_at: string | null;
}

export async function logUsage(userId: string | null | undefined, engineName: string): Promise<void> {
  if (!userId) return;

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return;

    const { error } = await admin.from("usage_logs").insert({
      user_id: userId,
      engine_name: engineName,
    });

    if (error) {
      console.error(`[logUsage] insert failed (${engineName}):`, error.message);
    }
  } catch (err) {
    console.error(`[logUsage] unexpected error (${engineName}):`, err);
  }
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const FREE_DEFAULTS: UsageSummary = {
    plan: "free",
    billing_cycle: null,
    monthly_limit: MONTHLY_LIMITS.free,
    analyses_used: 0,
    analyses_remaining: MONTHLY_LIMITS.free,
    expires_at: null,
  };

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return FREE_DEFAULTS;

    const { data: planRow } = await admin
      .from("user_plans")
      .select("plan, billing_cycle, active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    let effectivePlan: PlanKey = "free";
    let billingCycle: string | null = null;
    let expiresAt: string | null = null;

    if (planRow && planRow.active) {
      const expired = planRow.expires_at != null && new Date(planRow.expires_at) < new Date();

      if (!expired) {
        effectivePlan = (planRow.plan as PlanKey) ?? "free";
        billingCycle = planRow.billing_cycle ?? null;
        expiresAt = planRow.expires_at ?? null;
      }
    }

    const monthlyLimit = MONTHLY_LIMITS[effectivePlan] ?? MONTHLY_LIMITS.free;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error: countError } = await admin
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart);

    if (countError) {
      console.error("[getUsageSummary] count error:", countError.message);
      return {
        plan: effectivePlan,
        billing_cycle: billingCycle,
        monthly_limit: monthlyLimit,
        analyses_used: 0,
        analyses_remaining: monthlyLimit,
        expires_at: expiresAt,
      };
    }

    const used = count ?? 0;

    return {
      plan: effectivePlan,
      billing_cycle: billingCycle,
      monthly_limit: monthlyLimit,
      analyses_used: used,
      analyses_remaining: Math.max(0, monthlyLimit - used),
      expires_at: expiresAt,
    };
  } catch (err) {
    console.error("[getUsageSummary] unexpected error:", err);
    return FREE_DEFAULTS;
  }
}
