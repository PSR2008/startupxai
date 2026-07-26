import { z } from "zod";
import { normalizeHttpUrl } from "./safe-url";
import type { CategoryScore, EvidenceCategory, EvidenceConfidence, EvidenceDirection, ScoreComponent } from "./evidence-types";
import { SCORE_VERSION } from "./evidence-scoring";

export const evidenceTypes = [
  "verified_public_evidence",
  "founder_provided_evidence",
  "customer_research",
  "experiment_result",
  "assumption",
  "generated_assessment",
] as const;

export const evidenceWorkflowSchema = z.object({
  title: z.string().trim().min(1).max(160),
  claim: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(4000),
  evidence_source: z.enum(["founder_note", "customer_interview", "experiment_result", "public_url", "ai_suggestion_unverified"]).default("founder_note"),
  evidence_type: z.enum(evidenceTypes),
  evidence_direction: z.enum(["supporting", "contradicting", "neutral"]),
  source_url: z.string().trim().max(2048).optional().or(z.literal("")),
  source_name: z.string().trim().max(160).optional().or(z.literal("")),
  source_quality: z.enum(["low", "medium", "high"]),
  confidence: z.enum(["low", "medium", "high"]),
  collected_at: z.string().datetime().optional().or(z.literal("")),
  evidence_status: z.enum(["active", "archived"]).default("active"),
  linked_claims: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  public_source_metadata: z.object({
    originalUrl: z.string().url(),
    canonicalUrl: z.string().url(),
    pageTitle: z.string().nullable(),
    description: z.string().nullable(),
    publisher: z.string().nullable(),
    author: z.string().nullable(),
    publicationDate: z.string().nullable(),
    retrievedAt: z.string().datetime(),
    language: z.string().nullable(),
    faviconUrl: z.string().url().nullable(),
    hostname: z.string(),
    httpStatus: z.number().int(),
    contentType: z.string(),
    excerpt: z.string().nullable(),
    label: z.literal("Public source - founder selected"),
    explanation: z.literal("StartupX AI retrieved source metadata. The founder is responsible for deciding how this source relates to the claim."),
  }).optional(),
});

export const interviewSchema = z.object({
  participant_segment: z.string().trim().min(1).max(250),
  interview_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  problem_discussed: z.string().trim().min(1).max(1000),
  pain_severity: z.number().int().min(1).max(5),
  current_alternative: z.string().trim().max(500).optional().or(z.literal("")),
  key_quotes: z.string().trim().max(3000).optional().or(z.literal("")),
  objections: z.string().trim().max(2000).optional().or(z.literal("")),
  willingness_to_pay_signal: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  follow_up_action: z.string().trim().max(500).optional().or(z.literal("")),
  convert_to_evidence: z.boolean().default(false),
});

export const experimentSchema = z.object({
  hypothesis: z.string().trim().min(1).max(1000),
  experiment_type: z.string().trim().min(1).max(160),
  success_metric: z.string().trim().min(1).max(300),
  target_threshold: z.string().trim().min(1).max(300),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  status: z.enum(["planned", "active", "completed", "closed", "archived"]).default("planned"),
  measured_result: z.string().trim().max(1000).optional().or(z.literal("")),
  outcome: z.enum(["passed", "failed", "inconclusive"]).optional().nullable(),
  learning: z.string().trim().max(2000).optional().or(z.literal("")),
  next_decision: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function evidenceDirectionToDb(value: "supporting" | "contradicting" | "neutral"): EvidenceDirection {
  if (value === "supporting") return "supports";
  if (value === "contradicting") return "contradicts";
  return "neutral";
}

export function verifiedStatusForEvidenceType(type: typeof evidenceTypes[number]) {
  if (type === "verified_public_evidence") return "verified";
  if (type === "founder_provided_evidence" || type === "customer_research" || type === "experiment_result" || type === "assumption") return "user_provided";
  return "inferred";
}

export function reliabilityForQuality(quality: "low" | "medium" | "high") {
  return quality === "high" ? 85 : quality === "medium" ? 60 : 35;
}

export function normalizeWorkflowUrl(value?: string | null): string | null {
  const url = normalizeHttpUrl(value);
  return url?.toString() ?? null;
}

export function sanitizeText(value?: string | null, max = 4000): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isGeneratedAssessmentVerified(type: string, verifiedStatus: string) {
  return type === "generated_assessment" && verifiedStatus === "verified";
}

export interface StoredEvidenceForScore {
  id: string;
  title: string;
  claim: string | null;
  summary: string;
  evidence_category: EvidenceCategory | string;
  evidence_direction: "supports" | "contradicts" | "neutral";
  evidence_type: typeof evidenceTypes[number];
  source_quality: "low" | "medium" | "high";
  confidence: EvidenceConfidence;
  reliability_score: number;
  created_at: string;
  updated_at?: string;
}

export interface StoredExperimentForScore {
  id: string;
  hypothesis: string;
  status: "planned" | "active" | "completed" | "closed" | "archived";
  outcome: "passed" | "failed" | "inconclusive" | null;
  learning?: string | null;
  updated_at?: string;
}

function daysOld(dateValue?: string | null) {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

export function evidenceWeight(item: StoredEvidenceForScore): number {
  const typeWeight =
    item.evidence_type === "verified_public_evidence" ? 1 :
    item.evidence_type === "customer_research" ? 0.9 :
    item.evidence_type === "experiment_result" ? 0.95 :
    item.evidence_type === "founder_provided_evidence" ? 0.55 :
    item.evidence_type === "assumption" ? 0.25 :
    0.15;
  const qualityWeight = item.source_quality === "high" ? 1 : item.source_quality === "medium" ? 0.7 : 0.4;
  const freshnessWeight = Math.max(0.55, 1 - daysOld(item.updated_at ?? item.created_at) / 365);
  const confidenceWeight = item.confidence === "high" ? 1 : item.confidence === "medium" ? 0.7 : 0.45;
  return typeWeight * qualityWeight * freshnessWeight * confidenceWeight;
}

export function recalculateStoredEvidenceScore(params: {
  category: EvidenceCategory;
  label: string;
  evidence: StoredEvidenceForScore[];
  experiments: StoredExperimentForScore[];
}): CategoryScore {
  const relevant = params.evidence.filter((item) => item.evidence_category === params.category || item.evidence_category === "evidence_strength");
  const completedExperiments = params.experiments.filter((item) => item.status === "completed" || item.status === "closed");
  const supporting = relevant.filter((item) => item.evidence_direction === "supports");
  const contradicting = relevant.filter((item) => item.evidence_direction === "contradicts");
  const weightedSupport = supporting.reduce((sum, item) => sum + evidenceWeight(item), 0);
  const weightedContradiction = contradicting.reduce((sum, item) => sum + evidenceWeight(item), 0);
  const experimentLift = completedExperiments.reduce((sum, item) => sum + (item.outcome === "passed" ? 0.75 : item.outcome === "failed" ? -0.55 : 0), 0);
  const evidenceCount = relevant.length + completedExperiments.length;
  const raw = 42 + weightedSupport * 13 - weightedContradiction * 14 + experimentLift * 8;
  const hasMinimumEvidence = evidenceCount >= 3 && (supporting.length > 0 || contradicting.length > 0);
  const score = hasMinimumEvidence ? Math.max(0, Math.min(100, Math.round(raw))) : Math.max(0, Math.min(44, Math.round(raw)));
  const confidence: EvidenceConfidence =
    !hasMinimumEvidence ? "low" :
    evidenceCount >= 6 && weightedSupport + weightedContradiction >= 3 ? "high" :
    "medium";
  const components: ScoreComponent[] = [
    {
      componentName: "Supporting evidence",
      normalizedValue: Math.min(100, Math.round(weightedSupport * 25)),
      weight: 0.4,
      contribution: Math.round(Math.min(100, weightedSupport * 25) * 0.4),
      evidenceKind: supporting.some((item) => item.evidence_type === "verified_public_evidence") ? "verified" : supporting.length ? "user_provided" : "unavailable",
      rawSignal: { evidenceCount: supporting.length, linkedEvidenceIds: supporting.map((item) => item.id) },
    },
    {
      componentName: "Contradicting evidence",
      normalizedValue: Math.max(0, 100 - Math.round(weightedContradiction * 30)),
      weight: 0.25,
      contribution: Math.round(Math.max(0, 100 - weightedContradiction * 30) * 0.25),
      evidenceKind: contradicting.length ? "user_provided" : "unavailable",
      rawSignal: { evidenceCount: contradicting.length, linkedEvidenceIds: contradicting.map((item) => item.id) },
    },
    {
      componentName: "Completed experiments",
      normalizedValue: Math.min(100, completedExperiments.length * 30),
      weight: 0.2,
      contribution: Math.round(Math.min(100, completedExperiments.length * 30) * 0.2),
      evidenceKind: completedExperiments.length ? "user_provided" : "unavailable",
      rawSignal: { evidenceCount: completedExperiments.length, linkedExperimentIds: completedExperiments.map((item) => item.id) },
    },
    {
      componentName: "Minimum evidence threshold",
      normalizedValue: hasMinimumEvidence ? 100 : 15,
      weight: 0.15,
      contribution: Math.round((hasMinimumEvidence ? 100 : 15) * 0.15),
      evidenceKind: hasMinimumEvidence ? "user_provided" : "unavailable",
      rawSignal: { evidenceCount, minimumRequired: 3 },
    },
  ];

  return {
    category: params.category,
    label: params.label,
    score,
    confidence,
    conclusion: hasMinimumEvidence
      ? `${params.label} reflects stored evidence and completed experiment results with ${confidence} confidence.`
      : `Insufficient evidence. Add at least three relevant evidence items or completed experiments before using this score for a decision.`,
    supportingEvidence: supporting.length ? supporting.map((item) => item.summary).slice(0, 4) : ["Insufficient evidence"],
    opposingEvidence: contradicting.map((item) => item.summary).slice(0, 4),
    assumptions: relevant.filter((item) => item.evidence_type === "assumption").map((item) => item.claim || item.title),
    uncertainty: hasMinimumEvidence ? "Stored evidence meets the minimum threshold, but the score remains provisional." : "Minimum evidence threshold is not met, so confidence is low.",
    sourceReferences: relevant.map((item) => ({ title: item.title, sourceName: item.source_quality })),
    methodology: "Calculated from stored evidence using source quality, freshness, confidence, direction, and completed experiment outcomes. Generated assessments are weighted lowest and never counted as verified evidence.",
    recommendedNextAction: hasMinimumEvidence ? "Review contradicting evidence and record the next decision." : "Add customer research, verified public evidence, or a completed experiment result.",
    components,
    scoreVersion: SCORE_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}
