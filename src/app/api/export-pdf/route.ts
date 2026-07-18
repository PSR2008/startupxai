import { NextRequest, NextResponse } from "next/server";
import { getPlanEntitlements } from "@/lib/plans";
import { getEffectivePlan, logUsage } from "@/lib/usage";
import { featureNotAvailableResponse, getUserIdFromRequest } from "@/lib/usage-limit";

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

  await logUsage(userId, "pdf-export", "pdf_export");
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
