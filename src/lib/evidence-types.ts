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
  normalizedValue: number;
  weight: number;
  contribution: number;
  evidenceKind: EvidenceKind;
}

export interface CategoryScore {
  category: EvidenceCategory;
  label: string;
  score: number;
  confidence: EvidenceConfidence;
  conclusion: string;
  supportingEvidence: string[];
  opposingEvidence: string[];
  assumptions: string[];
  uncertainty: string;
  sourceReferences: Array<{ title: string; url?: string | null; sourceName: string }>;
  methodology: string;
  recommendedNextAction: string;
  components: ScoreComponent[];
  scoreVersion: string;
  calculatedAt: string;
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
    overallScore: number;
    confidence: EvidenceConfidence;
    scoreVersion: string;
    createdAt: string;
  };
  input: EvidenceEngineInput;
  scores: CategoryScore[];
  evidenceItems: EvidenceItem[];
  providerRuns: ProviderRunStatus[];
  suggestedExperiments: SuggestedExperiment[];
  limitations: string[];
}
