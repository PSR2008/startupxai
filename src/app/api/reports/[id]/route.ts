import { NextRequest, NextResponse } from "next/server";
import { deleteAnalysisByUser, getAnalysisByUser, setAnalysisShareToken } from "@/lib/supabase";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan, logUsage } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";
import { createShareLink, revokeShareLinks, type ShareExpiryOption } from "@/lib/reporting";

function normalizeExpiry(value: unknown): ShareExpiryOption {
  return value === "7d" || value === "30d" ? value : "none";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const report = await getAnalysisByUser({ userId, analysisId: id });
  if (!report) {
    return NextResponse.json(
      { success: false, error: "Report not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, report });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;
  const deleted = await deleteAnalysisByUser({ userId, analysisId: id });
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: "Unable to delete report" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);
  if (!entitlements.canShareReports) {
    return featureNotAvailableResponse({
      feature: "shareable_reports",
      plan,
    });
  }

  const { id } = await context.params;
  const report = await getAnalysisByUser({ userId, analysisId: id });
  if (!report) {
    return NextResponse.json(
      { success: false, error: "Report not found" },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const shouldShare = body?.share !== false;

  if (!shouldShare) {
    const revoked = await revokeShareLinks({
      ownerUserId: userId,
      reportKind: "analysis",
      reportId: id,
    });
    const legacyRevoked = await setAnalysisShareToken({
      userId,
      analysisId: id,
      shareToken: null,
    });
    if (!revoked || !legacyRevoked) {
      return NextResponse.json(
        { success: false, error: "Unable to revoke report sharing" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shareToken: null,
      shareUrl: null,
    });
  }

  const link = await createShareLink({
    ownerUserId: userId,
    reportKind: "analysis",
    reportId: id,
    expiresIn: normalizeExpiry(body?.expiresIn),
  });

  if (!link) {
    return NextResponse.json(
      { success: false, error: "Unable to update report sharing" },
      { status: 500 }
    );
  }

  await logUsage(userId, "share-report", "share_report");

  return NextResponse.json({
    success: true,
    shareToken: link.token,
    shareUrl: `/share/${link.token}`,
    expiresAt: link.expiresAt,
  });
}
