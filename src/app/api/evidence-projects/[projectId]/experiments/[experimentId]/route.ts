import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { experimentSchema, reliabilityForQuality, sanitizeText } from "@/lib/evidence-workflow";
import { recalculateAndPersistProject, recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; experimentId: string }> }) {
  const rate = generalRateLimiter.check(`experiment-update:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId, experimentId } = await params;
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = experimentSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["hypothesis", "experiment_type", "success_metric", "target_threshold", "measured_result", "learning", "next_decision"] as const) {
    if (parsed.data[key] !== undefined) update[key] = sanitizeText(parsed.data[key], 2000);
  }
  if (parsed.data.target_threshold !== undefined) update.pass_threshold = sanitizeText(parsed.data.target_threshold, 300);
  if (parsed.data.start_date !== undefined) update.start_date = parsed.data.start_date || null;
  if (parsed.data.end_date !== undefined) update.end_date = parsed.data.end_date || null;
  if (parsed.data.status) {
    update.status = parsed.data.status;
    if (parsed.data.status === "closed") update.closed_at = new Date().toISOString();
  }
  if (parsed.data.outcome !== undefined) update.outcome = parsed.data.outcome ?? null;

  const { data, error } = await admin.from("validation_experiments")
    .update(update)
    .eq("id", experimentId)
    .eq("validation_project_id", projectId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ success: false, error: error?.message || "Experiment not found" }, { status: 404 });

  if ((data.status === "completed" || data.status === "closed") && data.measured_result) {
    const evidencePayload = {
      validation_project_id: projectId,
      user_id: userId,
      created_by: userId,
      evidence_category: "evidence_strength",
      title: `Experiment result: ${data.experiment_type}`,
      claim: data.hypothesis,
      summary: data.learning || data.measured_result,
      source_name: "Experiment result",
      source_type: "experiment_result",
      evidence_type: "experiment_result",
      source_quality: "high",
      confidence: data.outcome === "inconclusive" ? "medium" : "high",
      evidence_status: "active",
      accessed_at: new Date().toISOString(),
      relevance_score: 85,
      reliability_score: reliabilityForQuality("high"),
      sentiment: data.outcome === "failed" ? "negative" : data.outcome === "passed" ? "positive" : "mixed",
      evidence_direction: data.outcome === "failed" ? "contradicts" : data.outcome === "passed" ? "supports" : "neutral",
      verified_status: "user_provided",
      raw_metadata: { experimentId: data.id },
      updated_at: new Date().toISOString(),
    };
    const { data: existingEvidence } = await admin
      .from("evidence_items")
      .select("id")
      .eq("validation_project_id", projectId)
      .eq("user_id", userId)
      .filter("raw_metadata->>experimentId", "eq", data.id)
      .maybeSingle();
    if (existingEvidence?.id) {
      await admin.from("evidence_items").update(evidencePayload).eq("id", existingEvidence.id).eq("user_id", userId);
    } else {
      await admin.from("evidence_items").insert(evidencePayload);
    }
  }

  await recordProjectActivity({
    projectId,
    userId,
    activityType: data.status === "completed" || data.status === "closed" ? "experiment_completed" : "experiment_started",
    title: `Experiment ${data.status}: ${data.experiment_type}`,
    metadata: { experimentId, status: data.status, outcome: data.outcome },
  });
  await recalculateAndPersistProject(projectId, userId, "Experiment lifecycle updated");
  return NextResponse.json({ success: true, data });
}
