import { NextRequest, NextResponse } from "next/server";
import { AIProviderResponseError, AIProviderTimeoutError, COMPETITOR_MAX_RETRIES, COMPETITOR_MAX_TOKENS, COMPETITOR_PROVIDER_TIMEOUT_MS, analyzeCompetitors } from "@/lib/ai";
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
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_AUTH_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "INTERNAL_ERROR";

const GENERIC_MESSAGE = "Competitor analysis could not be completed.";
const PROVIDER_UNEXPECTED_MESSAGE = "The analysis provider returned an invalid response.";
const PROVIDER_TIMEOUT_MESSAGE = "The analysis provider took too long to respond.";
const PROVIDER_RATE_LIMIT_MESSAGE = "The analysis provider is temporarily busy. Please try again shortly.";
const PROVIDER_AUTH_MESSAGE = "The analysis service is temporarily unavailable.";

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

  if (error instanceof AIProviderTimeoutError || (error instanceof Error && error.name === "AbortError")) {
    return { code: "PROVIDER_TIMEOUT", status: 504, retryable: true, providerStatus: null };
  }

  const status = providerStatus(error);
  if (status === 408 || status === 504) {
    return { code: "PROVIDER_TIMEOUT", status: 504, retryable: true, providerStatus: status };
  }
  if (status === 429) {
    return { code: "PROVIDER_RATE_LIMITED", status: 502, retryable: true, providerStatus: status };
  }
  if (status === 401 || status === 403) {
    return { code: "PROVIDER_AUTH_ERROR", status: 502, retryable: false, providerStatus: status };
  }
  if (status && status >= 400) {
    return { code: "PROVIDER_ERROR", status: 502, retryable: status === 429 || status >= 500, providerStatus: status };
  }

  return { code: "INTERNAL_ERROR", status: 500, retryable: true, providerStatus: null };
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
  requestId: string;
  code: CompetitorErrorCode;
  providerStatus: number | null;
  durationMs: number;
  retryable: boolean;
  internalAccess: boolean;
  role: string;
}) {
  console.error("[CompetitorEngine] analysis failed", {
    tool: "competitor-intelligence",
    requestId: params.requestId,
    errorCategory: params.code,
    providerStatus: params.providerStatus,
    durationMs: params.durationMs,
    retryable: params.retryable,
    internalAccess: params.internalAccess,
    role: params.role,
  });
}

function logPhase(params: {
  requestId: string;
  phase: string;
  elapsedMs: number;
  providerStatus?: number | null;
  code?: string;
  retryable?: boolean;
}) {
  console.info("[CompetitorEngine] phase", {
    route: "api/analyze/competitor",
    requestId: params.requestId,
    phase: params.phase,
    elapsedMs: params.elapsedMs,
    providerName: params.phase === "provider" ? "anthropic" : undefined,
    modelName: params.phase === "provider" ? process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6" : undefined,
    providerStatus: params.providerStatus,
    code: params.code,
    retryable: params.retryable,
  });
}

function userMessageFor(code: CompetitorErrorCode): string {
  if (code === "PROVIDER_TIMEOUT") return PROVIDER_TIMEOUT_MESSAGE;
  if (code === "PROVIDER_RATE_LIMITED") return PROVIDER_RATE_LIMIT_MESSAGE;
  if (code === "PROVIDER_AUTH_ERROR") return PROVIDER_AUTH_MESSAGE;
  if (code === "INVALID_PROVIDER_RESPONSE") return PROVIDER_UNEXPECTED_MESSAGE;
  return GENERIC_MESSAGE;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const ip = getRequestIp(request);
  const rateStartedAt = Date.now();
  const rateCheck = analysisRateLimiter.check(ip);
  logPhase({ requestId, phase: "rate_limit", elapsedMs: Date.now() - rateStartedAt });
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
  const parseBodyStartedAt = Date.now();
  try { body = await request.json(); } catch {
    return jsonError({ code: "INVALID_REQUEST", message: "Invalid request body.", status: 400, retryable: false });
  }
  logPhase({ requestId, phase: "request_body", elapsedMs: Date.now() - parseBodyStartedAt });

  const validationStartedAt = Date.now();
  const validation = validateInput(competitorEngineSchema, body);
  logPhase({ requestId, phase: "validation", elapsedMs: Date.now() - validationStartedAt });
  if (!validation.success) {
    return jsonError({ code: "INVALID_REQUEST", message: "Please check the competitor analysis inputs.", status: 400, retryable: false });
  }

  const authStartedAt = Date.now();
  const usageCheck = await checkAnalysisAccess(request, "competitor");
  logPhase({ requestId, phase: "auth_entitlements", elapsedMs: Date.now() - authStartedAt });
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
    const result = await analyzeCompetitors(validation.data, (phase, elapsedMs) => logPhase({ requestId, phase, elapsedMs }));
    const usageStartedAt = Date.now();
    const recorded = await recordAnalysisUsage(usageCheck.userId!, "competitor", usageCheck.entitlements.monthlyAnalyses);
    logPhase({ requestId, phase: "usage_record", elapsedMs: Date.now() - usageStartedAt });
    if (!recorded.inserted) {
      const response = limitReachedAfterWorkResponse({ feature: "monthly_analyses", currentUsage: recorded.currentUsage, limit: recorded.limit, plan: usageCheck.plan });
      return safeAccessErrorResponse(response);
    }
    const persistenceStartedAt = Date.now();
    const ipHash = await hashIp(ip);
    const sessionId = request.headers.get("x-session-id") || `anon_${Date.now()}`;
    if (usageCheck.entitlements.canSaveHistory) {
      await saveAnalysis({ sessionId, engineType: "competitor", inputData: validation.data as unknown as Record<string, unknown>, outputData: result as unknown as Record<string, unknown>, ipHash, userId: usageCheck.userId ?? undefined });
    }
    logPhase({ requestId, phase: "persistence", elapsedMs: Date.now() - persistenceStartedAt });
    await trackProductEvent("competitor_analysis_succeeded", {
      userId: usageCheck.userId,
      properties: {
        tool: "competitor-intelligence",
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        provider_timeout_ms: COMPETITOR_PROVIDER_TIMEOUT_MS,
        provider_max_retries: COMPETITOR_MAX_RETRIES,
        output_token_limit: COMPETITOR_MAX_TOKENS,
      },
    });
    logPhase({ requestId, phase: "total", elapsedMs: Date.now() - startedAt });
    return jsonSuccess(result);
  } catch (error) {
    const failure = classifyProviderFailure(error);
    const durationMs = Date.now() - startedAt;
    safeLogFailure({
      requestId,
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
        request_id: requestId,
        error_code: failure.code,
        retryable: failure.retryable,
      },
    });
    logPhase({ requestId, phase: "total", elapsedMs: durationMs, providerStatus: failure.providerStatus, code: failure.code, retryable: failure.retryable });
    return jsonError({
      code: failure.code,
      message: userMessageFor(failure.code),
      status: failure.status,
      retryable: failure.retryable,
    });
  }
}

export async function GET() {
  return jsonError({ code: "INVALID_REQUEST", message: "Method not allowed.", status: 405, retryable: false });
}
