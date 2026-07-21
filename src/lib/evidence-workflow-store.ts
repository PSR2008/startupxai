import { getSupabaseAdminClient } from "./supabase";
import { recalculateStoredEvidenceScore, type StoredEvidenceForScore, type StoredExperimentForScore } from "./evidence-workflow";
import type { EvidenceCategory } from "./evidence-types";

const CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  problem_clarity: "Problem clarity",
  customer_urgency: "Customer urgency",
  existing_alternatives: "Existing alternatives",
  competitor_saturation: "Competitor saturation",
  differentiation: "Differentiation",
  monetisation_potential: "Monetisation potential",
  distribution_difficulty: "Distribution difficulty",
  market_timing: "Market timing",
  execution_complexity: "Execution complexity",
  evidence_strength: "Evidence strength",
};

export async function requireProjectAccess(projectId: string, userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("validation_projects")
    .select("id, user_id, startup_name, overall_score, confidence, created_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function recordProjectActivity(params: {
  projectId: string;
  userId: string;
  activityType: string;
  title: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.from("project_activity").insert({
    validation_project_id: params.projectId,
    user_id: params.userId,
    activity_type: params.activityType,
    title: params.title,
    metadata: params.metadata ?? {},
  });
}

export async function fetchProjectWorkflow(projectId: string, userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const project = await requireProjectAccess(projectId, userId);
  if (!project) return null;

  const [evidence, interviews, experiments, activity, links] = await Promise.all([
    admin.from("evidence_items").select("*").eq("validation_project_id", projectId).eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("customer_interviews").select("*").eq("validation_project_id", projectId).eq("user_id", userId).order("interview_date", { ascending: false }),
    admin.from("validation_experiments").select("*").eq("validation_project_id", projectId).eq("user_id", userId).order("updated_at", { ascending: false }),
    admin.from("project_activity").select("*").eq("validation_project_id", projectId).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("evidence_claim_links").select("*").eq("validation_project_id", projectId).eq("user_id", userId),
  ]);

  if (evidence.error || interviews.error || experiments.error || activity.error || links.error) return null;
  return {
    project,
    evidence: evidence.data ?? [],
    interviews: interviews.data ?? [],
    experiments: experiments.data ?? [],
    activity: activity.data ?? [],
    claimLinks: links.data ?? [],
  };
}

export async function recalculateAndPersistProject(projectId: string, userId: string, reason: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const workflow = await fetchProjectWorkflow(projectId, userId);
  if (!workflow) return null;

  const evidence = workflow.evidence as StoredEvidenceForScore[];
  const experiments = workflow.experiments as StoredExperimentForScore[];
  const categories = Object.keys(CATEGORY_LABELS) as EvidenceCategory[];
  const scores = categories.map((category) => recalculateStoredEvidenceScore({
    category,
    label: CATEGORY_LABELS[category],
    evidence,
    experiments,
  }));
  const overall = Math.round(scores.reduce((sum, score) => sum + score.score, 0) / (scores.length || 1));
  const confidence = scores.filter((score) => score.confidence !== "low").length >= 4 ? "medium" : "low";
  const previousScore = Number(workflow.project.overall_score ?? 0);

  await admin.from("validation_projects").update({
    overall_score: overall,
    confidence,
    updated_at: new Date().toISOString(),
  }).eq("id", projectId).eq("user_id", userId);

  await admin.from("score_history").insert({
    validation_project_id: projectId,
    user_id: userId,
    previous_score: previousScore,
    new_score: overall,
    change_reason: reason,
    score_version: scores[0]?.scoreVersion ?? "sx-evidence-v1",
  });

  if (previousScore !== overall) {
    await recordProjectActivity({
      projectId,
      userId,
      activityType: "score_changed",
      title: `Evidence Score changed from ${previousScore} to ${overall}`,
      metadata: { previousScore, newScore: overall, reason },
    });
  }

  return { overallScore: overall, confidence, scores };
}
