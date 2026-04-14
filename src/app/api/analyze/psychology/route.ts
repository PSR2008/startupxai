import { NextRequest, NextResponse } from "next/server";
import { analyzePsychology } from "@/lib/ai";
import { psychologyEngineSchema, validateInput } from "@/lib/validation";
import { analysisRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/supabase";
import { hashIp } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateCheck = analysisRateLimiter.check(ip);
  if (!rateCheck.success) return rateLimitResponse(rateCheck.retryAfter!);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateInput(psychologyEngineSchema, body);
  if (!validation.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 422 });
  }

  try {
    const result = await analyzePsychology(validation.data);
    const ipHash = await hashIp(ip);
    const sessionId = request.headers.get("x-session-id") || `anon_${Date.now()}`;
    await saveAnalysis({ sessionId, engineType: "psychology", inputData: validation.data as unknown as Record<string, unknown>, outputData: result as unknown as Record<string, unknown>, ipHash });
    return NextResponse.json({ success: true, data: result }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PsychologyEngine] Analysis failed:", error);
    return NextResponse.json({ success: false, error: "Analysis failed. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
