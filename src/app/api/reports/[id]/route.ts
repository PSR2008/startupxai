import { NextRequest, NextResponse } from "next/server";
import { deleteAnalysisByUser, getAnalysisByUser } from "@/lib/supabase";
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
