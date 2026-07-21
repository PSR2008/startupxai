import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { assertPublicHttpUrl } from "@/lib/safe-url";
import {
  evidenceDirectionToDb,
  evidenceWorkflowSchema,
  isGeneratedAssessmentVerified,
  reliabilityForQuality,
  sanitizeText,
  verifiedStatusForEvidenceType,
} from "@/lib/evidence-workflow";
import { recalculateAndPersistProject, recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const rate = generalRateLimiter.check(`evidence-write:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId } = await params;
  const project = await requireProjectAccess(projectId, userId);
  if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = evidenceWorkflowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });

  const url = parsed.data.source_url ? await assertPublicHttpUrl(parsed.data.source_url) : null;
  if (parsed.data.source_url && !url) return NextResponse.json({ success: false, error: "Invalid or unsafe source URL" }, { status: 422 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
  const verifiedStatus = verifiedStatusForEvidenceType(parsed.data.evidence_type);
  if (isGeneratedAssessmentVerified(parsed.data.evidence_type, verifiedStatus)) {
    return NextResponse.json({ success: false, error: "Generated assessments cannot be verified evidence" }, { status: 422 });
  }

  const { data, error } = await admin.from("evidence_items").insert({
    validation_project_id: projectId,
    user_id: userId,
    created_by: userId,
    evidence_category: parsed.data.evidence_type === "assumption" ? "evidence_strength" : "problem_clarity",
    title: sanitizeText(parsed.data.title, 160),
    claim: sanitizeText(parsed.data.claim, 500),
    summary: sanitizeText(parsed.data.description, 4000),
    source_name: sanitizeText(parsed.data.source_name || "Manual entry", 160),
    source_url: url?.toString() ?? null,
    source_type: parsed.data.evidence_type,
    evidence_type: parsed.data.evidence_type,
    source_quality: parsed.data.source_quality,
    confidence: parsed.data.confidence,
    evidence_status: parsed.data.evidence_status,
    published_or_retrieved_at: parsed.data.collected_at || null,
    accessed_at: parsed.data.collected_at || new Date().toISOString(),
    relevance_score: 70,
    reliability_score: reliabilityForQuality(parsed.data.source_quality),
    sentiment: "neutral",
    evidence_direction: evidenceDirectionToDb(parsed.data.evidence_direction),
    verified_status: verifiedStatus,
    raw_metadata: { linkedClaims: parsed.data.linked_claims },
    updated_at: new Date().toISOString(),
  }).select("*").single();

  if (error || !data) return NextResponse.json({ success: false, error: error?.message || "Evidence could not be saved" }, { status: 500 });

  if (parsed.data.linked_claims.length) {
    await admin.from("evidence_claim_links").insert(parsed.data.linked_claims.map((claim) => ({
      validation_project_id: projectId,
      evidence_item_id: data.id,
      user_id: userId,
      claim: sanitizeText(claim, 500),
    })));
  }

  await recordProjectActivity({ projectId, userId, activityType: "evidence_added", title: `Evidence added: ${data.title}`, metadata: { evidenceId: data.id } });
  await recalculateAndPersistProject(projectId, userId, "Evidence item added");

  return NextResponse.json({ success: true, data }, { status: 201 });
}
