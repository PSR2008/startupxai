import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { fetchProjectWorkflow } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const rate = generalRateLimiter.check(`workflow:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

  const { projectId } = await params;
  const workflow = await fetchProjectWorkflow(projectId, userId);
  if (!workflow) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: workflow }, { headers: { "Cache-Control": "no-store" } });
}
