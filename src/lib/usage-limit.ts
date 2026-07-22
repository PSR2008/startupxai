import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  canUseEngine,
  getPlanEntitlements,
  type EngineId,
  type GenerationFeature,
  type PlanEntitlements,
  type PlanKey,
} from "./plans";
import { getFeatureUsage, recordUsageIfWithinLimit } from "./usage";
import { getUserEntitlements, type UserRole } from "./entitlements";

export interface FeatureAccess {
  allowed: boolean;
  userId: string | null;
  plan: PlanKey;
  activePlan: PlanKey;
  role: UserRole;
  internalAccess: boolean;
  paidSubscriptionActive: boolean;
  entitlements: PlanEntitlements;
  response?: NextResponse;
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

function unauthenticatedAccess(): FeatureAccess {
  return {
    allowed: false,
    userId: null,
    plan: "free",
    activePlan: "free",
    role: "user",
    internalAccess: false,
    paidSubscriptionActive: false,
    entitlements: getPlanEntitlements("free"),
    response: NextResponse.json(
      {
        success: false,
        code: "AUTHENTICATION_REQUIRED",
        error: "Please sign in to use StartupX AI.",
        message: "Please sign in to use StartupX AI.",
      },
      { status: 401 }
    ),
  };
}

function limitResponse(params: {
  feature: string;
  currentUsage: number;
  limit: number;
  plan: PlanKey;
}): NextResponse {
  const upgradeRecommended =
    params.plan === "free" ? "founder" :
    params.plan === "founder" ? "growth" :
    params.plan === "growth" ? "scale" :
    null;

  const planLabel = params.plan === "free" ? "Starter" : params.plan;
  const featureLabel =
    params.feature === "monthly_analyses" ? "analyses" :
    params.feature === "cold-dm" ? "ColdDM generations" :
    params.feature === "brand-forge" ? "BrandForge generations" :
    params.feature;
  const message = `You have used all ${params.limit} ${planLabel} ${featureLabel} for this month.`;

  return NextResponse.json(
    {
      success: false,
      code: "PLAN_LIMIT_REACHED",
      error: message,
      message,
      feature: params.feature,
      currentUsage: params.currentUsage,
      limit: params.limit,
      plan: params.plan,
      upgradeRecommended,
    },
    { status: 402 }
  );
}

function featureUnavailableResponse(params: {
  feature: string;
  engine?: string;
  plan: PlanKey;
}): NextResponse {
  const upgradeRecommended =
    params.feature === "shareable_reports" ? "growth" :
    params.feature === "analysis_history" ? "founder" :
    params.feature === "pdf_export" ? "founder" :
    params.feature === "investor_memo" ? "founder" :
    params.feature === "slide_ready_summary" ? "founder" :
    params.plan === "scale" ? null :
    "founder";

  const message =
    params.feature === "engine_access"
      ? "This intelligence engine is available on Founder and higher plans."
      : params.feature === "shareable_reports"
      ? "Shareable reports are available on Growth and Scale plans."
      : params.feature === "analysis_history"
      ? "Saved analysis history is available on Founder and higher plans."
      : params.feature === "pdf_export"
      ? "PDF exports are available on Founder and higher plans."
      : params.feature === "investor_memo"
      ? "Investor memos are available on Founder and higher plans."
      : params.feature === "slide_ready_summary"
      ? "Slide-ready summaries are available on Founder and higher plans."
      : "This feature is not available on your current plan.";

  return NextResponse.json(
    {
      success: false,
      code: "FEATURE_NOT_AVAILABLE",
      error: message,
      message,
      feature: params.feature,
      engine: params.engine,
      plan: params.plan,
      upgradeRecommended,
    },
    { status: 403 }
  );
}

export async function checkAnalysisAccess(req: NextRequest, engine: EngineId): Promise<FeatureAccess> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return unauthenticatedAccess();

  const userEntitlements = await getUserEntitlements(userId);
  const plan = userEntitlements.effectivePlan;
  const entitlements = userEntitlements.enabledFeatures;

  if (!canUseEngine(plan, engine)) {
    return {
      allowed: false,
      userId,
      plan,
      activePlan: userEntitlements.activePlan,
      role: userEntitlements.role,
      internalAccess: userEntitlements.internalAccess,
      paidSubscriptionActive: userEntitlements.paidSubscriptionActive,
      entitlements,
      response: featureUnavailableResponse({
        feature: "engine_access",
        engine,
        plan,
      }),
    };
  }

  const usage = await getFeatureUsage(userId, "analysis");
  if (usage.currentUsage >= usage.limit) {
    return {
      allowed: false,
      userId,
      plan,
      activePlan: userEntitlements.activePlan,
      role: userEntitlements.role,
      internalAccess: userEntitlements.internalAccess,
      paidSubscriptionActive: userEntitlements.paidSubscriptionActive,
      entitlements,
      response: limitResponse({
        feature: "monthly_analyses",
        currentUsage: usage.currentUsage,
        limit: usage.limit,
        plan,
      }),
    };
  }

  return {
    allowed: true,
    userId,
    plan,
    activePlan: userEntitlements.activePlan,
    role: userEntitlements.role,
    internalAccess: userEntitlements.internalAccess,
    paidSubscriptionActive: userEntitlements.paidSubscriptionActive,
    entitlements,
  };
}

export async function checkGenerationAccess(
  req: NextRequest,
  feature: GenerationFeature
): Promise<FeatureAccess> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return unauthenticatedAccess();

  const userEntitlements = await getUserEntitlements(userId);
  const plan = userEntitlements.effectivePlan;
  const entitlements = userEntitlements.enabledFeatures;
  const usage = await getFeatureUsage(userId, feature);

  if (usage.currentUsage >= usage.limit) {
    return {
      allowed: false,
      userId,
      plan,
      activePlan: userEntitlements.activePlan,
      role: userEntitlements.role,
      internalAccess: userEntitlements.internalAccess,
      paidSubscriptionActive: userEntitlements.paidSubscriptionActive,
      entitlements,
      response: limitResponse({
        feature,
        currentUsage: usage.currentUsage,
        limit: usage.limit,
        plan,
      }),
    };
  }

  return {
    allowed: true,
    userId,
    plan,
    activePlan: userEntitlements.activePlan,
    role: userEntitlements.role,
    internalAccess: userEntitlements.internalAccess,
    paidSubscriptionActive: userEntitlements.paidSubscriptionActive,
    entitlements,
  };
}

export async function recordAnalysisUsage(userId: string, engine: EngineId, limit: number) {
  return recordUsageIfWithinLimit({ userId, feature: "analysis", engineName: engine, limit });
}

export async function recordGenerationUsage(
  userId: string,
  feature: GenerationFeature,
  _plan: PlanKey
) {
  const entitlements = await getUserEntitlements(userId);
  return recordUsageIfWithinLimit({
    userId,
    feature,
    engineName: feature,
    limit: feature === "cold-dm"
      ? entitlements.usageLimits.coldDmMonthlyLimit
      : entitlements.usageLimits.brandForgeMonthlyLimit,
  });
}

export async function checkUsageLimit(req: NextRequest): Promise<FeatureAccess> {
  return checkAnalysisAccess(req, "idea");
}

export function limitReachedAfterWorkResponse(params: {
  feature: string;
  currentUsage: number;
  limit: number;
  plan: PlanKey;
}): NextResponse {
  return limitResponse(params);
}

export function featureNotAvailableResponse(params: {
  feature: string;
  engine?: string;
  plan: PlanKey;
}): NextResponse {
  return featureUnavailableResponse(params);
}
