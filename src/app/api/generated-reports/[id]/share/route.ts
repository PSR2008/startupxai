import { NextRequest, NextResponse } from "next/server";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";
import {
  createShareLink,
  getGeneratedReportForOwner,
  revokeShareLinks,
  type ShareExpiryOption,
} from "@/lib/reporting";

function normalizeExpiry(value: unknown): ShareExpiryOption {
  return value === "7d" || value === "30d" ? value : "none";
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, code: "AUTHENTICATION_REQUIRED", error: "Authentication required" },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);
  if (!entitlements.canShareReports) {
    return featureNotAvailableResponse({ feature: "shareable_reports", plan });
  }

  const { id } = await context.params;
  const report = await getGeneratedReportForOwner(userId, id);
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
      reportKind: "generated_report",
      reportId: id,
    });
    return NextResponse.json({ success: revoked });
  }

  const link = await createShareLink({
    ownerUserId: userId,
    reportKind: "generated_report",
    reportId: id,
    expiresIn: normalizeExpiry(body?.expiresIn),
  });

  if (!link) {
    return NextResponse.json(
      { success: false, error: "Unable to create secure share link" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    shareToken: link.token,
    shareUrl: `/share/${link.token}`,
    expiresAt: link.expiresAt,
  });
}
