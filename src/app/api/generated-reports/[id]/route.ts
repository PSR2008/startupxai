import { NextRequest, NextResponse } from "next/server";
import { getGeneratedReportForOwner } from "@/lib/reporting";
import { getUserIdFromRequest } from "@/lib/usage-limit";

export async function GET(
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

  const { id } = await context.params;
  const report = await getGeneratedReportForOwner(userId, id);
  if (!report) {
    return NextResponse.json(
      { success: false, error: "Report not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, report });
}
