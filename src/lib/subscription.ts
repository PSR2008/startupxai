import { getSupabaseAdminClient } from "./supabase";
import { getPlanLabel, normalizeBillingCycle, type BillingCycle, type PlanKey } from "./plans";

export interface SubscriptionStatus {
  plan: PlanKey;
  label: string;
  billingCycle: BillingCycle | null;
  active: boolean;
  expiresAt: string | null;
  isExpired: boolean;
}

export function getFreeSubscriptionStatus(): SubscriptionStatus {
  return {
    plan: "free",
    label: getPlanLabel("free"),
    billingCycle: null,
    active: false,
    expiresAt: null,
    isExpired: false,
  };
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return getFreeSubscriptionStatus();

    const { data, error } = await admin
      .from("user_plans")
      .select("plan, billing_cycle, active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data || data.plan !== "founder") {
      return getFreeSubscriptionStatus();
    }

    const expiresAt = data.expires_at ?? null;
    const isExpired = Boolean(expiresAt && new Date(expiresAt) < new Date());
    const active = Boolean(data.active) && !isExpired;

    if (!active) {
      return {
        ...getFreeSubscriptionStatus(),
        expiresAt,
        isExpired,
      };
    }

    return {
      plan: "founder",
      label: getPlanLabel("founder"),
      billingCycle: normalizeBillingCycle(data.billing_cycle),
      active,
      expiresAt,
      isExpired,
    };
  } catch (err) {
    console.error("[getSubscriptionStatus] unexpected error:", err);
    return getFreeSubscriptionStatus();
  }
}
