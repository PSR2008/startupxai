import { NextRequest, NextResponse } from "next/server";
import { getAnalysisByUser } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";

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
