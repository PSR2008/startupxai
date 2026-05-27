import { NextRequest, NextResponse } from "next/server";
import { deleteAnalysisByUser, getAnalysisByUser, setAnalysisShareToken } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import crypto from "crypto";

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

export async function PATCH(
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
  const body = await req.json().catch(() => ({}));
  const shouldShare = body?.share !== false;
  const shareToken = shouldShare ? crypto.randomBytes(24).toString("hex") : null;
  const updated = await setAnalysisShareToken({ userId, analysisId: id, shareToken });

  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Unable to update report sharing" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    shareToken,
    shareUrl: shareToken ? `/share/${shareToken}` : null,
  });
}
