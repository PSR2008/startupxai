import { NextRequest, NextResponse } from "next/server";
import { getAnalysisByShareToken } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 24) {
    return NextResponse.json(
      { success: false, error: "Shared report not found" },
      { status: 404 }
    );
  }

  const report = await getAnalysisByShareToken(token);
  if (!report) {
    return NextResponse.json(
      { success: false, error: "Shared report not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, report });
}
