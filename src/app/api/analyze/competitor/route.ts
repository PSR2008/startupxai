import { NextRequest, NextResponse } from "next/server";
import { AIProviderResponseError, analyzeCompetitors } from "@/lib/ai";
import { competitorEngineSchema, validateInput } from "@/lib/validation";
import {
  analysisRateLimiter,
  getRequestIp,
} from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/supabase";
import { hashIp } from "@/lib/utils";
import { checkAnalysisAccess, limitReachedAfterWorkResponse, recordAnalysisUsage } from "@/lib/usage-limit";
import { trackProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

type CompetitorErrorCode =
  | "INVALID_REQUEST"
  | "AUTHENTICATION_REQUIRED"
  | "FEATURE_NOT_AVAILABLE"
  | "PLAN_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "PROVIDER_TIMEOUT"
  | "INVALID_PROVIDER_RESPONSE"
  | "INTERNAL_ERROR";

const GENERIC_MESSAGE = "Competitor analysis could not be completed. Please try again.";
const PROVIDER_UNEXPECTED_MESSAGE = "The analysis provider returned an unexpected response.";

function jsonSuccess(data: unknown) {
  return NextResponse.json(
    { ok: true, success: true, data },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

function jsonError(params: {
  code: CompetitorErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  headers?: HeadersInit;
}) {
  return NextResponse.json(
    {
      ok: false,
      success: false,
      error: {
        code: params.code,
        message: params.message,
        retryable: params.retryable,
      },
    },
    {
      status: params.status,
      headers: {
        "Cache-Control": "no-store",
        ...(params.headers ?? {}),
      },
    }
  );
}

function providerStatus(error: unknown): number | null {
  if (error && typeof error === "object") {
    const record = error as { status?: unknown; statusCode?: unknown };
    const status = Number(record.status ?? record.statusCode);
    return Number.isFinite(status) ? status : null;
  }
  return null;
}

function classifyProviderFailure(error: unknown): {
  code: CompetitorErrorCode;
  status: number;
  retryable: boolean;
  providerStatus: number | null;
} {
  if (error instanceof AIProviderResponseError) {
    return { code: error.code, status: 502, retryable: true, providerStatus: null };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return { code: "PROVIDER_TIMEOUT", status: 504, retryable: true, providerStatus: null };
  }

  const status = providerStatus(error);
  if (status === 408 || status === 504) {
    return { code: "PROVIDER_TIMEOUT", status: 504, retryable: true, providerStatus: status };
  }
  if (status && status >= 400) {
    return { code: "PROVIDER_ERROR", status: 502, retryable: status === 429 || status >= 500, providerStatus: status };
  }

  return { code: "INTERNAL_ERROR", status: 500, retryable: true, providerStatus: null };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new Error("Competitor analysis provider timed out.");
      error.name = "AbortError";
      reject(error);
    }, ms);
  });

  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function safeAccessErrorResponse(response: NextResponse) {
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.clone().json();
  } catch {
    payload = {};
  }

  const status = response.status;
  const code =
    payload.code === "AUTHENTICATION_REQUIRED"
      ? "AUTHENTICATION_REQUIRED"
      : payload.code === "FEATURE_NOT_AVAILABLE"
      ? "FEATURE_NOT_AVAILABLE"
      : payload.code === "PLAN_LIMIT_REACHED"
      ? "PLAN_LIMIT_REACHED"
      : status === 401
      ? "AUTHENTICATION_REQUIRED"
      : status === 403
      ? "FEATURE_NOT_AVAILABLE"
      : "PLAN_LIMIT_REACHED";

  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : code === "AUTHENTICATION_REQUIRED"
      ? "Please sign in again."
      : code === "PLAN_LIMIT_REACHED"
      ? "Usage limit reached."
      : "This feature is not available on your current plan.";

  return jsonError({
    code,
    message,
    status: code === "PLAN_LIMIT_REACHED" ? 429 : status === 402 ? 403 : status,
    retryable: code === "PLAN_LIMIT_REACHED",
  });
}

function safeLogFailure(params: {
  code: CompetitorErrorCode;
  providerStatus: number | null;
  durationMs: number;
  retryable: boolean;
  internalAccess: boolean;
  role: string;
}) {
  console.error("[CompetitorEngine] analysis failed", {
    tool: "competitor-intelligence",
    errorCategory: params.code,
    providerStatus: params.providerStatus,
    durationMs: params.durationMs,
    retryable: params.retryable,
    internalAccess: params.internalAccess,
    role: params.role,
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const ip = getRequestIp(request);
  const rateCheck = analysisRateLimiter.check(ip);
  if (!rateCheck.success) {
    return jsonError({
      code: "RATE_LIMITED",
      message: "Usage limit reached.",
      status: 429,
      retryable: true,
      headers: {
        "Retry-After": String(rateCheck.retryAfter!),
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonError({ code: "INVALID_REQUEST", message: "Invalid request body.", status: 400, retryable: false });
  }

  const validation = validateInput(competitorEngineSchema, body);
  if (!validation.success) {
    return jsonError({ code: "INVALID_REQUEST", message: "Please check the competitor analysis inputs.", status: 400, retryable: false });
  }

  const usageCheck = await checkAnalysisAccess(request, "competitor");
  if (!usageCheck.allowed) return safeAccessErrorResponse(usageCheck.response!);

  await trackProductEvent("competitor_analysis_started", {
    userId: usageCheck.userId,
    properties: { tool: "competitor-intelligence" },
  });
  if (request.headers.get("x-startupx-retry") === "1") {
    await trackProductEvent("competitor_analysis_retried", {
      userId: usageCheck.userId,
      properties: { tool: "competitor-intelligence" },
    });
  }

  try {
    const result = await withTimeout(analyzeCompetitors(validation.data), 52_000);
    const recorded = await recordAnalysisUsage(usageCheck.userId!, "competitor", usageCheck.entitlements.monthlyAnalyses);
    if (!recorded.inserted) {
      const response = limitReachedAfterWorkResponse({ feature: "monthly_analyses", currentUsage: recorded.currentUsage, limit: recorded.limit, plan: usageCheck.plan });
      return safeAccessErrorResponse(response);
    }
    const ipHash = await hashIp(ip);
    const sessionId = request.headers.get("x-session-id") || `anon_${Date.now()}`;
    if (usageCheck.entitlements.canSaveHistory) {
      await saveAnalysis({ sessionId, engineType: "competitor", inputData: validation.data as unknown as Record<string, unknown>, outputData: result as unknown as Record<string, unknown>, ipHash, userId: usageCheck.userId ?? undefined });
    }
    await trackProductEvent("competitor_analysis_succeeded", {
      userId: usageCheck.userId,
      properties: {
        tool: "competitor-intelligence",
        duration_ms: Date.now() - startedAt,
      },
    });
    return jsonSuccess(result);
  } catch (error) {
    const failure = classifyProviderFailure(error);
    const durationMs = Date.now() - startedAt;
    safeLogFailure({
      code: failure.code,
      providerStatus: failure.providerStatus,
      durationMs,
      retryable: failure.retryable,
      internalAccess: usageCheck.internalAccess,
      role: usageCheck.role,
    });
    await trackProductEvent("competitor_analysis_failed", {
      userId: usageCheck.userId,
      properties: {
        tool: "competitor-intelligence",
        error_code: failure.code,
        retryable: failure.retryable,
      },
    });
    return jsonError({
      code: failure.code,
      message: failure.code === "INVALID_PROVIDER_RESPONSE" ? PROVIDER_UNEXPECTED_MESSAGE : GENERIC_MESSAGE,
      status: failure.status,
      retryable: failure.retryable,
    });
  }
}

export async function GET() {
  return jsonError({ code: "INVALID_REQUEST", message: "Method not allowed.", status: 405, retryable: false });
}
