import { NextRequest, NextResponse } from "next/server";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";
import { trackProductEvent } from "@/lib/analytics";
import { createGeneratedReport, type ReportOutputType } from "@/lib/reporting";

function normalizeReportType(value: unknown): ReportOutputType {
  return value === "investor_memo" || value === "slide_summary" ? value : "detailed";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, code: "AUTHENTICATION_REQUIRED", error: "Please sign in to generate reports." },
      { status: 401 }
    );
  }

  const { plan } = await getEffectivePlan(userId);
  const entitlements = getPlanEntitlements(plan);
  const body = await req.json().catch(() => ({}));
  const reportType = normalizeReportType(body?.reportType);

  if (reportType === "detailed" && !entitlements.canExportPdf) {
    return featureNotAvailableResponse({ feature: "pdf_export", plan });
  }
  if (reportType === "investor_memo" && !entitlements.canGenerateInvestorMemo) {
    return featureNotAvailableResponse({ feature: "investor_memo", plan });
  }
  if (reportType === "slide_summary" && !entitlements.canGenerateSlideSummary) {
    return featureNotAvailableResponse({ feature: "slide_ready_summary", plan });
  }

  const { id } = await context.params;
  await trackProductEvent("report_generation_started", {
    userId,
    properties: { report_type: reportType },
  });

  const report = await createGeneratedReport({ userId, analysisId: id, reportType });
  if (!report) {
    await trackProductEvent("report_generation_failed", {
      userId,
      properties: { report_type: reportType },
    });
    return NextResponse.json(
      { success: false, error: "Your report could not be generated. Please try again." },
      { status: 500 }
    );
  }

  await trackProductEvent(
    reportType === "investor_memo"
      ? "investor_memo_generated"
      : reportType === "slide_summary"
      ? "slide_summary_generated"
      : "detailed_report_generated",
    { userId, properties: { report_type: reportType } }
  );

  return NextResponse.json({ success: true, report });
}
