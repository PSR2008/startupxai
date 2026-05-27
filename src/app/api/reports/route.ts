import { NextRequest, NextResponse } from "next/server";
import { getRecentAnalysesByUser } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 8;
  const reports = await getRecentAnalysesByUser(userId, limit);

  return NextResponse.json({ success: true, reports });
}
