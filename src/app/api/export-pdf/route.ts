import { NextRequest, NextResponse } from "next/server";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan, logUsage } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";
import { trackProductEvent } from "@/lib/analytics";
import { getAnalysisForOwner, getGeneratedReportForOwner } from "@/lib/reporting";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      {
        error: "AUTHENTICATION_REQUIRED",
        message: "Please sign in to export PDF reports.",
      },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);

  if (!entitlements.canExportPdf) {
    return featureNotAvailableResponse({
      feature: "pdf_export",
      plan,
    });
  }

  const body = await req.json().catch(() => ({}));
  const reportId = typeof body?.reportId === "string" ? body.reportId : "";
  const reportKind = body?.reportKind === "generated_report" ? "generated_report" : "analysis";

  if (reportId) {
    const owned =
      reportKind === "generated_report"
        ? await getGeneratedReportForOwner(userId, reportId)
        : await getAnalysisForOwner(userId, reportId);

    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }
  }

  await logUsage(userId, "pdf-export", "pdf_export");
  await trackProductEvent("pdf_downloaded", {
    userId,
    properties: { report_kind: reportKind },
  });
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
