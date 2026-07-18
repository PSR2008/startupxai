import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  canUseEngine,
  getGenerationLimit,
  getPlanEntitlements,
  type EngineId,
  type GenerationFeature,
  type PlanEntitlements,
  type PlanKey,
} from "./plans";
import { getEffectivePlan, getFeatureUsage, recordUsageIfWithinLimit } from "./usage";

export interface FeatureAccess {
  allowed: boolean;
  userId: string | null;
  plan: PlanKey;
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
    entitlements: getPlanEntitlements("free"),
    response: NextResponse.json(
      {
        error: "AUTHENTICATION_REQUIRED",
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

  return NextResponse.json(
    {
      error: "PLAN_LIMIT_REACHED",
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
    params.plan === "scale" ? null :
    "founder";

  return NextResponse.json(
    {
      error: "FEATURE_NOT_AVAILABLE",
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

  const planInfo = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(planInfo.plan);

  if (!canUseEngine(planInfo.plan, engine)) {
    return {
      allowed: false,
      userId,
      plan: planInfo.plan,
      entitlements,
      response: featureUnavailableResponse({
        feature: "engine_access",
        engine,
        plan: planInfo.plan,
      }),
    };
  }

  const usage = await getFeatureUsage(userId, "analysis");
  if (usage.currentUsage >= usage.limit) {
    return {
      allowed: false,
      userId,
      plan: planInfo.plan,
      entitlements,
      response: limitResponse({
        feature: "monthly_analyses",
        currentUsage: usage.currentUsage,
        limit: usage.limit,
        plan: planInfo.plan,
      }),
    };
  }

  return { allowed: true, userId, plan: planInfo.plan, entitlements };
}

export async function checkGenerationAccess(
  req: NextRequest,
  feature: GenerationFeature
): Promise<FeatureAccess> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return unauthenticatedAccess();

  const planInfo = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(planInfo.plan);
  const usage = await getFeatureUsage(userId, feature);

  if (usage.currentUsage >= usage.limit) {
    return {
      allowed: false,
      userId,
      plan: planInfo.plan,
      entitlements,
      response: limitResponse({
        feature,
        currentUsage: usage.currentUsage,
        limit: usage.limit,
        plan: planInfo.plan,
      }),
    };
  }

  return { allowed: true, userId, plan: planInfo.plan, entitlements };
}

export async function recordAnalysisUsage(userId: string, engine: EngineId, limit: number) {
  return recordUsageIfWithinLimit({ userId, feature: "analysis", engineName: engine, limit });
}

export async function recordGenerationUsage(
  userId: string,
  feature: GenerationFeature,
  plan: PlanKey
) {
  return recordUsageIfWithinLimit({
    userId,
    feature,
    engineName: feature,
    limit: getGenerationLimit(plan, feature),
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
