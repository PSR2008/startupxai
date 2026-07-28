import { NextRequest, NextResponse } from "next/server";
import { evidenceEngineSchema, validateInput } from "@/lib/validation";
import { analysisRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { checkAnalysisAccess, limitReachedAfterWorkResponse, recordAnalysisUsage } from "@/lib/usage-limit";
import { collectEvidence } from "@/lib/evidence-providers";
import { calculateEvidenceScores, overallValidationScore, SCORE_VERSION, suggestExperiments } from "@/lib/evidence-scoring";
import { persistEvidenceProject } from "@/lib/evidence-store";
import { trackProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rateCheck = analysisRateLimiter.check(`evidence:${ip}`);
  if (!rateCheck.success) return rateLimitResponse(rateCheck.retryAfter!);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateInput(evidenceEngineSchema, body);
  if (!validation.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: validation.errors }, { status: 422 });
  }

  const usageCheck = await checkAnalysisAccess(request, "idea");
  if (!usageCheck.allowed) return usageCheck.response!;

  try {
    await trackProductEvent("evidence_engine_started", {
      userId: usageCheck.userId,
      properties: { industry: validation.data.industry, stage: validation.data.developmentStage },
    });

    const { evidenceItems, providerRuns } = await collectEvidence(validation.data);
    const scores = calculateEvidenceScores(validation.data, evidenceItems);
    const overall = overallValidationScore(scores);
    const suggestedExperiments = suggestExperiments(validation.data, scores);

    const project = await persistEvidenceProject({
      userId: usageCheck.userId!,
      input: validation.data,
      evidenceItems,
      scores,
      providerRuns,
      suggestedExperiments,
      overallScore: overall.score,
      confidence: overall.confidence,
      scoreVersion: SCORE_VERSION,
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Evidence project could not be saved. Make sure migration 009_evidence_engine.sql has been run in Supabase." },
        { status: 500 }
      );
    }

    const recorded = await recordAnalysisUsage(usageCheck.userId!, "idea", usageCheck.entitlements.monthlyAnalyses);
    if (!recorded.inserted) {
      return limitReachedAfterWorkResponse({
        feature: "monthly_analyses",
        currentUsage: recorded.currentUsage,
        limit: recorded.limit,
        plan: usageCheck.plan,
      });
    }

    await trackProductEvent("evidence_engine_completed", {
      userId: usageCheck.userId,
      properties: {
        project_id: project.id,
        evidence_count: evidenceItems.length,
        overall_score: overall.score,
        confidence: overall.confidence,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        project,
        input: validation.data,
        scores,
        evidenceItems,
        providerRuns,
        suggestedExperiments,
        evidenceCoverage: overall.coverage,
        limitations: [
          "Founder input is context for what to test. It does not count as independent evidence for scoring.",
          "Numerical Evidence Scores are hidden until deterministic evidence thresholds are met.",
          "Planned experiments and generated assessments do not increase confidence.",
          "No market size, search volume, review count, Reddit frequency, or pricing claim is shown unless a provider actually retrieved it.",
        ],
      },
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[EvidenceEngine] failed:", error);
    await trackProductEvent("evidence_engine_failed", {
      userId: usageCheck.userId,
      properties: { reason: error instanceof Error ? error.message : "unknown" },
    });
    return NextResponse.json({ success: false, error: "Evidence validation failed. Please try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
