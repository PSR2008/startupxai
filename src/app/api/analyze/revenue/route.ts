import { NextRequest, NextResponse } from "next/server";
import { analyzeRevenue } from "@/lib/ai";
import { revenueEngineSchema, validateInput } from "@/lib/validation";
import { analysisRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { saveAnalysis } from "@/lib/supabase";
import { hashIp } from "@/lib/utils";
import { checkAnalysisAccess, limitReachedAfterWorkResponse, recordAnalysisUsage } from "@/lib/usage-limit";
import { trackProductEvent } from "@/lib/analytics";
import { calculatePricingScenarios } from "@/lib/pricing-calculations";

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

  const validation = validateInput(revenueEngineSchema, body);
  if (!validation.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 422 });
  }

  const usageCheck = await checkAnalysisAccess(request, "revenue");
  if (!usageCheck.allowed) return usageCheck.response!;

  try {
    await trackProductEvent("pricing_engine_started", {
      userId: usageCheck.userId,
      properties: { has_current_pricing: Boolean(validation.data.currentPricing) },
    });

    const calculations = calculatePricingScenarios({
      existingPriceIdea: validation.data.currentPricing,
      expectedCustomerWillingnessToPay: validation.data.expectedCustomerWillingnessToPay,
      estimatedCac: validation.data.estimatedCac,
      grossMarginPercent: validation.data.grossMarginPercent,
      freeTierAvailability: validation.data.freeTierAvailability,
      expectedFreeToPaidConversion: validation.data.expectedFreeToPaidConversion,
      targetMonthlyRevenue: validation.data.targetMonthlyRevenue,
      customerVolumeAssumption: validation.data.customerVolumeAssumption,
      variableCostPerCustomer: validation.data.variableCostPerCustomer,
    });
    const aiResult = await analyzeRevenue(validation.data);
    const result = {
      ...aiResult,
      pricingScenarios: calculations.scenarios,
      deterministicMetrics: {
        assumptionsUsed: calculations.assumptionsUsed,
        customersRequiredForTargetRevenue: calculations.customersRequiredForTargetRevenue,
        freemiumPayingCustomers: calculations.freemiumPayingCustomers,
        warnings: calculations.warnings,
      },
    };
    const recorded = await recordAnalysisUsage(usageCheck.userId!, "revenue", usageCheck.entitlements.monthlyAnalyses);
    if (!recorded.inserted) {
      return limitReachedAfterWorkResponse({ feature: "monthly_analyses", currentUsage: recorded.currentUsage, limit: recorded.limit, plan: usageCheck.plan });
    }
    const ipHash = await hashIp(ip);
    const sessionId = request.headers.get("x-session-id") || `anon_${Date.now()}`;
    if (usageCheck.entitlements.canSaveHistory) {
      await saveAnalysis({ sessionId, engineType: "revenue", inputData: validation.data as unknown as Record<string, unknown>, outputData: result as unknown as Record<string, unknown>, ipHash, userId: usageCheck.userId ?? undefined });
    }
    await trackProductEvent("pricing_engine_completed", {
      userId: usageCheck.userId,
      properties: {
        scenario_count: calculations.scenarios.length,
        warning_count: calculations.warnings.length,
      },
    });
    return NextResponse.json({ success: true, data: result }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[RevenueEngine] Analysis failed:", error);
    return NextResponse.json({ success: false, error: "Analysis failed. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
