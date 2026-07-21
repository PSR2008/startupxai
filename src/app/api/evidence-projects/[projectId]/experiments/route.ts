import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { experimentSchema, sanitizeText } from "@/lib/evidence-workflow";
import { recalculateAndPersistProject, recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const rate = generalRateLimiter.check(`experiment-write:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId } = await params;
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = experimentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

  const { data, error } = await admin.from("validation_experiments").insert({
    validation_project_id: projectId,
    user_id: userId,
    hypothesis: sanitizeText(parsed.data.hypothesis, 1000),
    experiment_type: sanitizeText(parsed.data.experiment_type, 160),
    success_metric: sanitizeText(parsed.data.success_metric, 300),
    target_threshold: sanitizeText(parsed.data.target_threshold, 300),
    pass_threshold: sanitizeText(parsed.data.target_threshold, 300),
    fail_threshold: "Below target threshold",
    assumption_tested: sanitizeText(parsed.data.hypothesis, 500),
    target_audience: "Target customer segment",
    steps: [],
    estimated_time: "User-defined",
    estimated_cost: "User-defined",
    minimum_sample_size: 1,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
    status: parsed.data.status,
    measured_result: sanitizeText(parsed.data.measured_result, 1000) || null,
    outcome: parsed.data.outcome ?? null,
    learning: sanitizeText(parsed.data.learning, 2000) || null,
    next_decision: sanitizeText(parsed.data.next_decision, 1000) || null,
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (error || !data) return NextResponse.json({ success: false, error: error?.message || "Experiment could not be saved" }, { status: 500 });

  await recordProjectActivity({ projectId, userId, activityType: "experiment_created", title: `Experiment created: ${data.experiment_type}`, metadata: { experimentId: data.id } });
  await recalculateAndPersistProject(projectId, userId, "Experiment created");
  return NextResponse.json({ success: true, data }, { status: 201 });
}
