import { NextRequest, NextResponse } from "next/server";
import { clearAnalysesByUser, getRecentAnalysesByUser, getReportStatsByUser } from "@/lib/supabase";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);
  if (!entitlements.canSaveHistory) {
    return featureNotAvailableResponse({
      feature: "analysis_history",
      plan,
    });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 8;
  const reports = await getRecentAnalysesByUser(userId, limit);
  const stats = await getReportStatsByUser(userId);

  return NextResponse.json({ success: true, reports, stats });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);
  if (!entitlements.canSaveHistory) {
    return featureNotAvailableResponse({
      feature: "analysis_history",
      plan,
    });
  }

  const deleted = await clearAnalysesByUser(userId);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: "Unable to clear report history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
