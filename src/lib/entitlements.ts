import { getSupabaseAdminClient } from "./supabase";
import {
  getPlanEntitlements,
  PLANS,
  type PlanEntitlements,
  type PlanKey,
} from "./plans";

export type UserRole = "user" | "internal" | "admin";

export interface UserEntitlements {
  role: UserRole;
  activePlan: PlanKey;
  effectivePlan: PlanKey;
  paidSubscriptionActive: boolean;
  internalAccess: boolean;
  billingCycle: string | null;
  expiresAt: string | null;
  enabledFeatures: PlanEntitlements;
  usageLimits: PlanEntitlements;
}

const INTERNAL_LIMIT = 1_000_000;

export function normalizeUserRole(value: unknown): UserRole {
  return value === "internal" || value === "admin" ? value : "user";
}

export function applyInternalLimits(entitlements: PlanEntitlements): PlanEntitlements {
  return {
    ...entitlements,
    monthlyAnalyses: INTERNAL_LIMIT,
    coldDmMonthlyLimit: INTERNAL_LIMIT,
    brandForgeMonthlyLimit: INTERNAL_LIMIT,
    startupWorkspaceLimit: INTERNAL_LIMIT,
  };
}

export function resolveEntitlements(params: {
  role?: unknown;
  plan?: unknown;
  active?: unknown;
  billingCycle?: string | null;
  expiresAt?: string | null;
  now?: Date;
}): UserEntitlements {
  const role = normalizeUserRole(params.role);
  const internalAccess = role === "internal" || role === "admin";
  const candidatePlan = typeof params.plan === "string" && params.plan in PLANS ? params.plan as PlanKey : "free";
  const expiresAt = params.expiresAt ?? null;
  const expired = Boolean(expiresAt && new Date(expiresAt) < (params.now ?? new Date()));
  const paidSubscriptionActive = Boolean(params.active) && candidatePlan !== "free" && !expired;
  const activePlan = paidSubscriptionActive ? candidatePlan : "free";
  const effectivePlan: PlanKey = internalAccess ? "scale" : activePlan;
  const base = getPlanEntitlements(effectivePlan);
  const enabledFeatures = internalAccess ? applyInternalLimits(base) : base;

  return {
    role,
    activePlan,
    effectivePlan,
    paidSubscriptionActive,
    internalAccess,
    billingCycle: paidSubscriptionActive ? params.billingCycle ?? null : null,
    expiresAt,
    enabledFeatures,
    usageLimits: enabledFeatures,
  };
}

export async function getUserEntitlements(userId: string): Promise<UserEntitlements> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return resolveEntitlements({});

    const [roleResult, planResult] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      admin.from("user_plans").select("plan, billing_cycle, active, expires_at").eq("user_id", userId).maybeSingle(),
    ]);

    if (roleResult.error) {
      console.error("[getUserEntitlements] role lookup failed:", roleResult.error.message);
    }
    if (planResult.error) {
      console.error("[getUserEntitlements] plan lookup failed:", planResult.error.message);
    }

    return resolveEntitlements({
      role: roleResult.data?.role,
      plan: planResult.data?.plan,
      active: planResult.data?.active,
      billingCycle: planResult.data?.billing_cycle ?? null,
      expiresAt: planResult.data?.expires_at ?? null,
    });
  } catch (err) {
    console.error("[getUserEntitlements] unexpected error:", err);
    return resolveEntitlements({});
  }
}

