import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { assertPublicHttpUrl } from "@/lib/safe-url";
import { evidenceDirectionToDb, evidenceWorkflowSchema, reliabilityForQuality, sanitizeText, verifiedStatusForEvidenceType } from "@/lib/evidence-workflow";
import { recalculateAndPersistProject, recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; evidenceId: string }> }) {
  const rate = generalRateLimiter.check(`evidence-update:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId, evidenceId } = await params;
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = evidenceWorkflowSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  const url = parsed.data.source_url ? await assertPublicHttpUrl(parsed.data.source_url) : null;
  if (parsed.data.source_url && !url) return NextResponse.json({ success: false, error: "Invalid or unsafe source URL" }, { status: 422 });

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title) update.title = sanitizeText(parsed.data.title, 160);
  if (parsed.data.claim) update.claim = sanitizeText(parsed.data.claim, 500);
  if (parsed.data.description) update.summary = sanitizeText(parsed.data.description, 4000);
  if (parsed.data.evidence_type) {
    update.evidence_type = parsed.data.evidence_type;
    update.source_type = parsed.data.evidence_type;
    update.verified_status = verifiedStatusForEvidenceType(parsed.data.evidence_type);
  }
  if (parsed.data.evidence_direction) update.evidence_direction = evidenceDirectionToDb(parsed.data.evidence_direction);
  if (parsed.data.source_name !== undefined) update.source_name = sanitizeText(parsed.data.source_name || "Manual entry", 160);
  if (parsed.data.source_url !== undefined) update.source_url = url?.toString() ?? null;
  if (parsed.data.source_quality) {
    update.source_quality = parsed.data.source_quality;
    update.reliability_score = reliabilityForQuality(parsed.data.source_quality);
  }
  if (parsed.data.confidence) update.confidence = parsed.data.confidence;
  if (parsed.data.evidence_status) update.evidence_status = parsed.data.evidence_status;
  if (parsed.data.collected_at !== undefined) update.published_or_retrieved_at = parsed.data.collected_at || null;

  const { data, error } = await admin.from("evidence_items")
    .update(update)
    .eq("id", evidenceId)
    .eq("validation_project_id", projectId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ success: false, error: error?.message || "Evidence not found" }, { status: 404 });
  await recordProjectActivity({ projectId, userId, activityType: "evidence_edited", title: `Evidence edited: ${data.title}`, metadata: { evidenceId } });
  await recalculateAndPersistProject(projectId, userId, "Evidence item edited");
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string; evidenceId: string }> }) {
  const rate = generalRateLimiter.check(`evidence-delete:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId, evidenceId } = await params;
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
  const { error } = await admin.from("evidence_items").delete().eq("id", evidenceId).eq("validation_project_id", projectId).eq("user_id", userId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  await recordProjectActivity({ projectId, userId, activityType: "evidence_deleted", title: "Evidence deleted", metadata: { evidenceId } });
  await recalculateAndPersistProject(projectId, userId, "Evidence item deleted");
  return NextResponse.json({ success: true });
}
