import { NextRequest, NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/usage";
import { getPlanEntitlements } from "@/lib/plans";
import { getUserIdFromRequest } from "@/lib/usage-limit";

const starterEntitlements = getPlanEntitlements("free");
const FREE_USAGE = {
  plan: "free",
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

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json(FREE_USAGE);

    const summary = await getUsageSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[check-usage] error:", error);
    return NextResponse.json(FREE_USAGE);
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
