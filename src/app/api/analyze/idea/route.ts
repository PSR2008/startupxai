import { NextRequest, NextResponse } from "next/server";
import { analyzeIdea } from "@/lib/ai";
import { ideaEngineSchema, validateInput } from "@/lib/validation";
import {
  analysisRateLimiter,
  getRequestIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/supabase";
import { hashIp } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const ip = getRequestIp(request);
  const rateCheck = analysisRateLimiter.check(ip);
  if (!rateCheck.success) {
    return rateLimitResponse(rateCheck.retryAfter!);
  }

  // 2. Parse body (no trust of content-type)
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Validate input
  const validation = validateInput(ideaEngineSchema, body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: validation.errors },
      { status: 422 }
    );
  }

  const input = validation.data;

  // 4. Run AI analysis
  try {
    const result = await analyzeIdea(input);

    // 5. Persist to DB (non-blocking)
    const ipHash = await hashIp(ip);
    const sessionId =
      request.headers.get("x-session-id") || `anon_${Date.now()}`;
    await saveAnalysis({
      sessionId,
      engineType: "idea",
      inputData: input as unknown as Record<string, unknown>,
      outputData: result as unknown as Record<string, unknown>,
      ipHash,
    });

    // 6. Return result
    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rateCheck.remaining),
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    // Never leak stack traces to client
    console.error("[IdeaEngine] Analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Analysis failed. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}

// Reject non-POST
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
