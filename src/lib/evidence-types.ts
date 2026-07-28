export type EvidenceCategory =
  | "problem_clarity"
  | "customer_urgency"
  | "existing_alternatives"
  | "competitor_saturation"
  | "differentiation"
  | "monetisation_potential"
  | "distribution_difficulty"
  | "market_timing"
  | "execution_complexity"
  | "evidence_strength";

export type EvidenceConfidence = "low" | "medium" | "high";
export type EvidenceDirection = "supports" | "contradicts" | "neutral";
export type EvidenceVerifiedStatus = "verified" | "inferred" | "user_provided" | "unavailable";
export type EvidenceKind = "verified" | "inferred" | "user_provided" | "ai_interpretation" | "unavailable";
export type EvidenceSentiment = "positive" | "neutral" | "negative" | "mixed";
export type EvidenceAssessmentStatus = "assessed" | "unassessed";

export interface EvidenceEngineInput {
  startupName: string;
  ideaDescription: string;
  targetCustomer: string;
  targetGeography: string;
  businessModel: string;
  industry: string;
  developmentStage: string;
  knownCompetitors?: string;
  mainAssumptions?: string;
  websiteUrl?: string;
}

export interface EvidenceItem {
  id: string;
  evidenceCategory: EvidenceCategory;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl?: string | null;
  sourceType: string;
  publishedOrRetrievedAt?: string | null;
  accessedAt: string;
  excerpt?: string | null;
  relevanceScore: number;
  reliabilityScore: number;
  sentiment: EvidenceSentiment;
  direction: EvidenceDirection;
  verifiedStatus: EvidenceVerifiedStatus;
  rawMetadata?: Record<string, unknown>;
}

export interface ScoreComponent {
  componentName: string;
  rawSignal: Record<string, unknown>;
  normalizedValue: number | null;
  weight: number;
  contribution: number | null;
  evidenceKind: EvidenceKind;
}

export interface ScoreEvidenceCoverage {
  assessable: boolean;
  qualifyingEvidenceCount: number;
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  completedExperimentCount: number;
  excludedFounderContextCount: number;
  excludedGeneratedAssessmentCount: number;
  minimumRequired: string;
}

export interface CategoryScore {
  category: EvidenceCategory;
  label: string;
  score: number | null;
  assessmentStatus: EvidenceAssessmentStatus;
  definition: string;
  confidence: EvidenceConfidence;
  conclusion: string;
  supportingEvidence: string[];
  opposingEvidence: string[];
  qualifyingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  excludedEvidenceIds: string[];
  excludedEvidenceSummary: string[];
  missingRequirements: string[];
  assumptions: string[];
  uncertainty: string;
  sourceReferences: Array<{ title: string; url?: string | null; sourceName: string }>;
  methodology: string;
  recommendedNextAction: string;
  components: ScoreComponent[];
  evidenceCoverage: ScoreEvidenceCoverage;
  scoreVersion: string;
  calculatedAt: string;
}

export interface OverallEvidenceCoverage {
  assessableDimensions: number;
  totalDimensions: number;
  minimumAssessableDimensions: number;
  qualifiedEvidenceCount: number;
  customerResearchCount: number;
  completedExperimentCount: number;
  verifiedPublicEvidenceCount: number;
  excludedFounderContextCount: number;
  excludedGeneratedAssessmentCount: number;
  missingDimensions: string[];
  statusLabel: string;
  summary: string;
}

export interface ProviderRunStatus {
  providerName: string;
  status: "configured" | "not_configured" | "success" | "failed" | "skipped";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SuggestedExperiment {
  experimentType: string;
  hypothesis: string;
  assumptionTested: string;
  targetAudience: string;
  steps: string[];
  estimatedTime: string;
  estimatedCost: string;
  successMetric: string;
  minimumSampleSize: number;
  passThreshold: string;
  failThreshold: string;
  status: "planned" | "active" | "completed" | "archived";
}

export interface ValidationProjectResult {
  project: {
    id: string;
    startupName: string;
    overallScore: number | null;
    confidence: EvidenceConfidence;
    scoreVersion: string;
    createdAt: string;
  };
  input: EvidenceEngineInput;
  scores: CategoryScore[];
  evidenceItems: EvidenceItem[];
  providerRuns: ProviderRunStatus[];
  suggestedExperiments: SuggestedExperiment[];
  evidenceCoverage: OverallEvidenceCoverage;
  limitations: string[];
}
