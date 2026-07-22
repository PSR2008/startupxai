import { getSupabaseAdminClient } from "./supabase";
import {
  getPlanEntitlements,
  type GenerationFeature,
  type PlanKey,
} from "./plans";
import { getUserEntitlements, type UserRole } from "./entitlements";

export interface UsageSummary {
  plan: PlanKey;
  active_plan: PlanKey;
  effective_plan: PlanKey;
  role: UserRole;
  internal_access: boolean;
  paid_subscription_active: boolean;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  cold_dm_limit: number;
  cold_dm_used: number;
  cold_dm_remaining: number;
  brand_forge_limit: number;
  brand_forge_used: number;
  brand_forge_remaining: number;
  workspace_limit: number;
  workspaces_used: number;
  workspaces_remaining: number;
  expires_at: string | null;
}

export type UsageFeatureType = "analysis" | "generation" | "pdf_export" | "share_report";

export interface UsageRecordResult {
  inserted: boolean;
  currentUsage: number;
  limit: number;
}

export async function logUsage(
  userId: string | null | undefined,
  engineName: string,
  featureType: UsageFeatureType = "analysis"
): Promise<void> {
  if (!userId) return;

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return;

    const { error } = await admin.from("usage_logs").insert({
      user_id: userId,
      engine_name: engineName,
      feature_type: featureType,
    });

    if (error) {
      console.error(`[logUsage] insert failed (${engineName}):`, error.message);
    }
  } catch (err) {
    console.error(`[logUsage] unexpected error (${engineName}):`, err);
  }
}

export async function getEffectivePlan(userId: string): Promise<{
  plan: PlanKey;
  active_plan: PlanKey;
  internal_access: boolean;
  paid_subscription_active: boolean;
  role: UserRole;
  billing_cycle: string | null;
  expires_at: string | null;
}> {
  try {
    const entitlements = await getUserEntitlements(userId);
    return {
      plan: entitlements.effectivePlan,
      active_plan: entitlements.activePlan,
      internal_access: entitlements.internalAccess,
      paid_subscription_active: entitlements.paidSubscriptionActive,
      role: entitlements.role,
      billing_cycle: entitlements.billingCycle,
      expires_at: entitlements.expiresAt,
    };
  } catch (err) {
    console.error("[getEffectivePlan] unexpected error:", err);
    return { plan: "free", active_plan: "free", internal_access: false, paid_subscription_active: false, role: "user", billing_cycle: null, expires_at: null };
  }
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function countMonthlyUsage(
  userId: string,
  featureType: UsageFeatureType,
  engineName?: string
): Promise<number> {
  const admin = getSupabaseAdminClient();
  if (!admin) return 0;

  let query = admin
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", getMonthStart());

  if (featureType === "analysis") {
    query = query.or("feature_type.eq.analysis,feature_type.is.null");
  } else {
    query = query.eq("feature_type", featureType);
  }

  if (engineName) query = query.eq("engine_name", engineName);

  const { count, error } = await query;
  if (error) {
    console.error("[countMonthlyUsage] count error:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function getFeatureUsage(userId: string, feature: "analysis" | GenerationFeature): Promise<{
  plan: PlanKey;
  currentUsage: number;
  limit: number;
}> {
  const userEntitlements = await getUserEntitlements(userId);
  const plan = userEntitlements.effectivePlan;
  if (feature === "analysis") {
    return {
      plan,
      currentUsage: await countMonthlyUsage(userId, "analysis"),
      limit: userEntitlements.usageLimits.monthlyAnalyses,
    };
  }

  return {
    plan,
    currentUsage: await countMonthlyUsage(userId, "generation", feature),
    limit: feature === "cold-dm"
      ? userEntitlements.usageLimits.coldDmMonthlyLimit
      : userEntitlements.usageLimits.brandForgeMonthlyLimit,
  };
}

export async function recordUsageIfWithinLimit(params: {
  userId: string;
  feature: "analysis" | GenerationFeature;
  engineName: string;
  limit: number;
}): Promise<UsageRecordResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { inserted: false, currentUsage: 0, limit: params.limit };

  const featureType: UsageFeatureType = params.feature === "analysis" ? "analysis" : "generation";
  const engineSpecific = params.feature !== "analysis";

  try {
    const { data, error } = await admin.rpc("try_insert_usage_log", {
      p_user_id: params.userId,
      p_feature_type: featureType,
      p_engine_name: params.engineName,
      p_limit: params.limit,
      p_engine_specific: engineSpecific,
    });

    if (!error && data && typeof data === "object") {
      const result = data as { inserted?: boolean; currentUsage?: number; current_usage?: number; limit?: number };
      return {
        inserted: Boolean(result.inserted),
        currentUsage: Number(result.currentUsage ?? result.current_usage ?? 0),
        limit: Number(result.limit ?? params.limit),
      };
    }

    if (error) {
      console.error("[recordUsageIfWithinLimit] rpc failed:", error.message);
    }
  } catch (err) {
    console.error("[recordUsageIfWithinLimit] rpc unexpected:", err);
  }

  const currentUsage = await countMonthlyUsage(
    params.userId,
    featureType,
    engineSpecific ? params.engineName : undefined
  );
  if (currentUsage >= params.limit) {
    return { inserted: false, currentUsage, limit: params.limit };
  }

  await logUsage(params.userId, params.engineName, featureType);
  return { inserted: true, currentUsage: currentUsage + 1, limit: params.limit };
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const starterEntitlements = getPlanEntitlements("free");
  const FREE_DEFAULTS: UsageSummary = {
    plan: "free",
    active_plan: "free",
    effective_plan: "free",
    role: "user",
    internal_access: false,
    paid_subscription_active: false,
    billing_cycle: null,
    monthly_limit: starterEntitlements.monthlyAnalyses,
    analyses_used: 0,
    analyses_remaining: starterEntitlements.monthlyAnalyses,
    cold_dm_limit: starterEntitlements.coldDmMonthlyLimit,
    cold_dm_used: 0,
    cold_dm_remaining: starterEntitlements.coldDmMonthlyLimit,
    brand_forge_limit: starterEntitlements.brandForgeMonthlyLimit,
    brand_forge_used: 0,
    brand_forge_remaining: starterEntitlements.brandForgeMonthlyLimit,
    workspace_limit: starterEntitlements.startupWorkspaceLimit,
    workspaces_used: 0,
    workspaces_remaining: starterEntitlements.startupWorkspaceLimit,
    expires_at: null,
  };

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return FREE_DEFAULTS;

    const userEntitlements = await getUserEntitlements(userId);
    const effectivePlan = userEntitlements.effectivePlan;
    const entitlements = userEntitlements.usageLimits;
    const used = await countMonthlyUsage(userId, "analysis");
    const coldDmUsed = await countMonthlyUsage(userId, "generation", "cold-dm");
    const brandForgeUsed = await countMonthlyUsage(userId, "generation", "brand-forge");
    const { count: workspaceCount } = await admin
      .from("founder_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId);

    return {
      plan: effectivePlan,
      active_plan: userEntitlements.activePlan,
      effective_plan: effectivePlan,
      role: userEntitlements.role,
      internal_access: userEntitlements.internalAccess,
      paid_subscription_active: userEntitlements.paidSubscriptionActive,
      billing_cycle: userEntitlements.billingCycle,
      monthly_limit: entitlements.monthlyAnalyses,
      analyses_used: used,
      analyses_remaining: Math.max(0, entitlements.monthlyAnalyses - used),
      cold_dm_limit: entitlements.coldDmMonthlyLimit,
      cold_dm_used: coldDmUsed,
      cold_dm_remaining: Math.max(0, entitlements.coldDmMonthlyLimit - coldDmUsed),
      brand_forge_limit: entitlements.brandForgeMonthlyLimit,
      brand_forge_used: brandForgeUsed,
      brand_forge_remaining: Math.max(0, entitlements.brandForgeMonthlyLimit - brandForgeUsed),
      workspace_limit: entitlements.startupWorkspaceLimit,
      workspaces_used: workspaceCount ?? 0,
      workspaces_remaining: Math.max(0, entitlements.startupWorkspaceLimit - (workspaceCount ?? 0)),
      expires_at: userEntitlements.expiresAt,
    };
  } catch (err) {
    console.error("[getUsageSummary] unexpected error:", err);
    return FREE_DEFAULTS;
  }
}
