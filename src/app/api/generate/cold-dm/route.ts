import { NextRequest, NextResponse } from "next/server";
import { generateColdDM } from "@/lib/ai";
import { coldDMSchema, validateInput } from "@/lib/validation";
import { generationRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/supabase";
import { hashIp } from "@/lib/utils";
import { checkGenerationAccess, limitReachedAfterWorkResponse, recordGenerationUsage } from "@/lib/usage-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateCheck = generationRateLimiter.check(ip);
  if (!rateCheck.success) return rateLimitResponse(rateCheck.retryAfter!);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateInput(coldDMSchema, body);
  if (!validation.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 422 });
  }

  const usageCheck = await checkGenerationAccess(request, "cold-dm");
  if (!usageCheck.allowed) return usageCheck.response!;

  try {
    const result = await generateColdDM(validation.data);
    const recorded = await recordGenerationUsage(usageCheck.userId!, "cold-dm", usageCheck.plan);
    if (!recorded.inserted) {
      return limitReachedAfterWorkResponse({ feature: "cold-dm", currentUsage: recorded.currentUsage, limit: recorded.limit, plan: usageCheck.plan });
    }
    const ipHash = await hashIp(ip);
    const sessionId = request.headers.get("x-session-id") || `anon_${Date.now()}`;
    if (usageCheck.entitlements.canSaveHistory) {
      await saveAnalysis({ sessionId, engineType: "cold-dm", inputData: validation.data as unknown as Record<string, unknown>, outputData: result as unknown as Record<string, unknown>, ipHash, userId: usageCheck.userId ?? undefined });
    }
    return NextResponse.json({ success: true, data: result }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ColdDM] Generation failed:", error);
    return NextResponse.json({ success: false, error: "Generation failed. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
