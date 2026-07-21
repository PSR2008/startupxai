import { getSupabaseAdminClient } from "./supabase";
import type {
  CategoryScore,
  EvidenceEngineInput,
  EvidenceItem,
  ProviderRunStatus,
  SuggestedExperiment,
  ValidationProjectResult,
} from "./evidence-types";

function toDbEvidence(item: EvidenceItem, projectId: string, userId: string) {
  return {
    validation_project_id: projectId,
    user_id: userId,
    evidence_category: item.evidenceCategory,
    title: item.title,
    summary: item.summary,
    source_name: item.sourceName,
    source_url: item.sourceUrl ?? null,
    source_type: item.sourceType,
    published_or_retrieved_at: item.publishedOrRetrievedAt ?? null,
    accessed_at: item.accessedAt,
    excerpt: item.excerpt ?? null,
    relevance_score: item.relevanceScore,
    reliability_score: item.reliabilityScore,
    sentiment: item.sentiment,
    evidence_direction: item.direction,
    verified_status: item.verifiedStatus,
    raw_metadata: item.rawMetadata ?? {},
  };
}

function toDbScore(score: CategoryScore, projectId: string, userId: string) {
  return {
    validation_project_id: projectId,
    user_id: userId,
    category: score.category,
    score: score.score,
    confidence: score.confidence,
    conclusion: score.conclusion,
    supporting_evidence: score.supportingEvidence,
    opposing_evidence: score.opposingEvidence,
    assumptions: score.assumptions,
    uncertainty: score.uncertainty,
    methodology: score.methodology,
    recommended_next_action: score.recommendedNextAction,
    score_version: score.scoreVersion,
    calculated_at: score.calculatedAt,
  };
}

function toDbExperiment(experiment: SuggestedExperiment, projectId: string, userId: string) {
  return {
    validation_project_id: projectId,
    user_id: userId,
    experiment_type: experiment.experimentType,
    hypothesis: experiment.hypothesis,
    assumption_tested: experiment.assumptionTested,
    target_audience: experiment.targetAudience,
    steps: experiment.steps,
    estimated_time: experiment.estimatedTime,
    estimated_cost: experiment.estimatedCost,
    success_metric: experiment.successMetric,
    minimum_sample_size: experiment.minimumSampleSize,
    pass_threshold: experiment.passThreshold,
    fail_threshold: experiment.failThreshold,
    status: experiment.status,
  };
}

export async function persistEvidenceProject(params: {
  userId: string;
  input: EvidenceEngineInput;
  evidenceItems: EvidenceItem[];
  scores: CategoryScore[];
  providerRuns: ProviderRunStatus[];
  suggestedExperiments: SuggestedExperiment[];
  overallScore: number;
  confidence: "low" | "medium" | "high";
  scoreVersion: string;
}): Promise<ValidationProjectResult["project"] | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data: project, error: projectError } = await admin
    .from("validation_projects")
    .insert({
      user_id: params.userId,
      startup_name: params.input.startupName,
      idea_description: params.input.ideaDescription,
      target_customer: params.input.targetCustomer,
      target_geography: params.input.targetGeography,
      business_model: params.input.businessModel,
      industry: params.input.industry,
      development_stage: params.input.developmentStage,
      known_competitors: params.input.knownCompetitors || null,
      main_assumptions: params.input.mainAssumptions || null,
      website_url: params.input.websiteUrl || null,
      overall_score: params.overallScore,
      confidence: params.confidence,
      score_version: params.scoreVersion,
    })
    .select("id, startup_name, overall_score, confidence, score_version, created_at")
    .single();

  if (projectError || !project) {
    console.error("[persistEvidenceProject] project insert failed:", projectError?.message);
    return null;
  }

  const projectId = String(project.id);

  if (params.evidenceItems.length) {
    const { error } = await admin.from("evidence_items").insert(params.evidenceItems.map((item) => toDbEvidence(item, projectId, params.userId)));
    if (error) console.error("[persistEvidenceProject] evidence insert failed:", error.message);
  }

  const { data: dbScores, error: scoreError } = await admin
    .from("validation_scores")
    .insert(params.scores.map((score) => toDbScore(score, projectId, params.userId)))
    .select("id, category");

  if (scoreError) {
    console.error("[persistEvidenceProject] score insert failed:", scoreError.message);
  } else if (dbScores) {
    const scoreIdByCategory = new Map(dbScores.map((row) => [String(row.category), String(row.id)]));
    const components = params.scores.flatMap((score) =>
      score.components.map((component) => ({
        validation_project_id: projectId,
        validation_score_id: scoreIdByCategory.get(score.category) ?? null,
        user_id: params.userId,
        component_name: component.componentName,
        raw_signal: component.rawSignal,
        normalized_value: component.normalizedValue,
        weight: component.weight,
        contribution: component.contribution,
        evidence_kind: component.evidenceKind,
      }))
    );
    if (components.length) {
      const { error } = await admin.from("score_components").insert(components);
      if (error) console.error("[persistEvidenceProject] components insert failed:", error.message);
    }
  }

  if (params.suggestedExperiments.length) {
    const { error } = await admin.from("validation_experiments").insert(params.suggestedExperiments.map((item) => toDbExperiment(item, projectId, params.userId)));
    if (error) console.error("[persistEvidenceProject] experiments insert failed:", error.message);
  }

  await admin.from("provider_runs").insert(params.providerRuns.map((run) => ({
    validation_project_id: projectId,
    user_id: params.userId,
    provider_name: run.providerName,
    status: run.status,
    message: run.message,
    completed_at: new Date().toISOString(),
    metadata: run.metadata ?? {},
  })));

  await admin.from("score_history").insert({
    validation_project_id: projectId,
    user_id: params.userId,
    previous_score: null,
    new_score: params.overallScore,
    change_reason: "Initial evidence-backed validation score created from founder input and available provider evidence.",
    score_version: params.scoreVersion,
  });

  await admin.from("project_activity").insert({
    validation_project_id: projectId,
    user_id: params.userId,
    activity_type: "project_created",
    title: "Validation project created",
    metadata: { overallScore: params.overallScore, confidence: params.confidence },
  });

  return {
    id: projectId,
    startupName: String(project.startup_name),
    overallScore: Number(project.overall_score),
    confidence: project.confidence as "low" | "medium" | "high",
    scoreVersion: String(project.score_version),
    createdAt: String(project.created_at),
  };
}
