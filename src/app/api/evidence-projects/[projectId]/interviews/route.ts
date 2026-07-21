import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { interviewSchema, reliabilityForQuality, sanitizeText } from "@/lib/evidence-workflow";
import { recalculateAndPersistProject, recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const rate = generalRateLimiter.check(`interview-write:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  const { projectId } = await params;
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = interviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

  const { data: interview, error } = await admin.from("customer_interviews").insert({
    validation_project_id: projectId,
    user_id: userId,
    participant_segment: sanitizeText(parsed.data.participant_segment, 250),
    interview_date: parsed.data.interview_date,
    problem_discussed: sanitizeText(parsed.data.problem_discussed, 1000),
    pain_severity: parsed.data.pain_severity,
    current_alternative: sanitizeText(parsed.data.current_alternative, 500) || null,
    key_quotes: sanitizeText(parsed.data.key_quotes, 3000) || null,
    objections: sanitizeText(parsed.data.objections, 2000) || null,
    willingness_to_pay_signal: sanitizeText(parsed.data.willingness_to_pay_signal, 500) || null,
    notes: sanitizeText(parsed.data.notes, 4000) || null,
    follow_up_action: sanitizeText(parsed.data.follow_up_action, 500) || null,
    updated_at: new Date().toISOString(),
  }).select("*").single();
  if (error || !interview) return NextResponse.json({ success: false, error: error?.message || "Interview could not be saved" }, { status: 500 });

  let evidence = null;
  if (parsed.data.convert_to_evidence) {
    const { data: evidenceRow } = await admin.from("evidence_items").insert({
      validation_project_id: projectId,
      user_id: userId,
      created_by: userId,
      evidence_category: "customer_urgency",
      title: `Interview: ${sanitizeText(parsed.data.participant_segment, 80)}`,
      claim: sanitizeText(parsed.data.problem_discussed, 500),
      summary: sanitizeText(parsed.data.key_quotes || parsed.data.notes || parsed.data.problem_discussed, 4000),
      source_name: "Customer interview",
      source_type: "customer_research",
      evidence_type: "customer_research",
      source_quality: parsed.data.pain_severity >= 4 ? "high" : "medium",
      confidence: parsed.data.pain_severity >= 4 ? "medium" : "low",
      evidence_status: "active",
      published_or_retrieved_at: `${parsed.data.interview_date}T00:00:00.000Z`,
      accessed_at: new Date().toISOString(),
      relevance_score: Math.min(100, parsed.data.pain_severity * 18),
      reliability_score: reliabilityForQuality(parsed.data.pain_severity >= 4 ? "high" : "medium"),
      sentiment: "neutral",
      evidence_direction: "supports",
      verified_status: "user_provided",
      raw_metadata: { interviewId: interview.id },
      updated_at: new Date().toISOString(),
    }).select("*").single();
    evidence = evidenceRow ?? null;
    if (evidenceRow) {
      await admin.from("customer_interviews").update({ converted_evidence_id: evidenceRow.id }).eq("id", interview.id).eq("user_id", userId);
    }
  }

  await recordProjectActivity({ projectId, userId, activityType: "interview_recorded", title: `Interview recorded: ${interview.participant_segment}`, metadata: { interviewId: interview.id, convertedToEvidence: Boolean(evidence) } });
  await recalculateAndPersistProject(projectId, userId, parsed.data.convert_to_evidence ? "Interview converted into customer research evidence" : "Interview recorded");
  return NextResponse.json({ success: true, data: { interview, evidence } }, { status: 201 });
}
