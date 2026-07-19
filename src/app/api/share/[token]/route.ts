import { NextRequest, NextResponse } from "next/server";
import { getAnalysisByShareToken } from "@/lib/supabase";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { getSharedReportByToken } from "@/lib/reporting";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const rateCheck = generalRateLimiter.check(`share:${getRequestIp(req)}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck.retryAfter!);

  const { token } = await context.params;
  if (!token || token.length < 24) {
    return NextResponse.json(
      { success: false, error: "Shared report not found" },
      { status: 404 }
    );
  }

  const shared = await getSharedReportByToken(token);
  if (shared) {
    return NextResponse.json({
      success: true,
      reportKind: shared.reportKind,
      report: shared.report,
    }, {
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const report = await getAnalysisByShareToken(token);
  if (!report) {
    return NextResponse.json(
      { success: false, error: "Shared report not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, reportKind: "analysis", report },
    { headers: { "X-Robots-Tag": "noindex, nofollow" } }
  );
}
