import type {
  CategoryScore,
  EvidenceCategory,
  EvidenceConfidence,
  EvidenceEngineInput,
  EvidenceItem,
  OverallEvidenceCoverage,
  ScoreComponent,
  SuggestedExperiment,
} from "./evidence-types";

export const SCORE_VERSION = "sx-evidence-v2";

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

type QualifyingKind = "public" | "customer" | "experiment";

interface DimensionRule {
  category: EvidenceCategory;
  definition: string;
  minimumRequired: string;
  accepts: QualifyingKind[];
  minQualifying: number;
  minKinds?: number;
  nextAction: string;
  assumption: string;
}

const DIMENSION_RULES: Record<EvidenceCategory, DimensionRule> = {
  problem_clarity: {
    category: "problem_clarity",
    definition: "Whether target customers have independently described the problem in concrete, repeatable terms.",
    minimumRequired: "At least 2 customer-research items or 1 completed problem experiment.",
    accepts: ["customer", "experiment"],
    minQualifying: 2,
    nextAction: "Record customer interviews that capture exact problem language, current workaround, and pain frequency.",
    assumption: "The founder's problem statement matches a real customer problem.",
  },
  customer_urgency: {
    category: "customer_urgency",
    definition: "Whether evidence shows customers feel the problem urgently enough to act.",
    minimumRequired: "At least 3 customer-research signals or 1 completed urgency experiment.",
    accepts: ["customer", "experiment"],
    minQualifying: 3,
    nextAction: "Run interviews or a demand test that records severity, frequency, and current workaround.",
    assumption: "Customers experience the problem often enough to prioritize a switch.",
  },
  existing_alternatives: {
    category: "existing_alternatives",
    definition: "Whether independent evidence identifies what customers use today instead of the proposed product.",
    minimumRequired: "At least 2 verified public sources, customer-research notes, or completed alternative-mapping experiments.",
    accepts: ["public", "customer", "experiment"],
    minQualifying: 2,
    nextAction: "Attach competitor pages, public pricing pages, or customer notes naming current alternatives.",
    assumption: "The named alternatives are actually used by the target customer.",
  },
  competitor_saturation: {
    category: "competitor_saturation",
    definition: "Whether the competitive landscape is evidenced enough to judge crowding and pressure.",
    minimumRequired: "At least 2 verified public competitor sources.",
    accepts: ["public"],
    minQualifying: 2,
    nextAction: "Add public competitor URLs and a source-backed positioning matrix.",
    assumption: "The visible competitor set represents the real options buyers compare.",
  },
  differentiation: {
    category: "differentiation",
    definition: "Whether buyers or public sources show the product is meaningfully different from alternatives.",
    minimumRequired: "At least 1 independent competitor/public source and 1 customer or completed experiment signal.",
    accepts: ["public", "customer", "experiment"],
    minQualifying: 2,
    minKinds: 2,
    nextAction: "Test whether target buyers can repeat the differentiated claim in their own words.",
    assumption: "The stated differentiation matters to buyers, not just to the founder.",
  },
  monetisation_potential: {
    category: "monetisation_potential",
    definition: "Whether evidence shows buyers have budget, willingness to pay, or paid alternatives.",
    minimumRequired: "At least 2 pricing, willingness-to-pay, paid-alternative, or completed pricing-test signals.",
    accepts: ["public", "customer", "experiment"],
    minQualifying: 2,
    nextAction: "Run a pricing test or record customer willingness-to-pay evidence with a concrete package and threshold.",
    assumption: "The target buyer has budget and authority to pay.",
  },
  distribution_difficulty: {
    category: "distribution_difficulty",
    definition: "Whether evidence shows the target customer can be reached through a repeatable channel.",
    minimumRequired: "At least 1 completed acquisition/channel experiment or 2 customer-research channel signals.",
    accepts: ["customer", "experiment"],
    minQualifying: 2,
    nextAction: "Run a 7-day outbound, waitlist, referral, or channel test with a predefined pass threshold.",
    assumption: "The target customer can be reached repeatedly without unsustainable effort.",
  },
  market_timing: {
    category: "market_timing",
    definition: "Whether recent independent sources explain why the problem is becoming more important now.",
    minimumRequired: "At least 2 recent verified public sources or completed timing experiments.",
    accepts: ["public", "experiment"],
    minQualifying: 2,
    nextAction: "Attach recent sources that support or challenge the timing claim.",
    assumption: "This is a better time to solve the problem than twelve months ago.",
  },
  execution_complexity: {
    category: "execution_complexity",
    definition: "Whether completed experiments or technical proof reduce uncertainty about the first executable path.",
    minimumRequired: "At least 1 completed experiment or implementation proof linked to the riskiest scope assumption.",
    accepts: ["experiment"],
    minQualifying: 1,
    nextAction: "Complete a concierge MVP, prototype test, or manual workflow test before scoring execution confidence.",
    assumption: "The team can test the riskiest assumption before building the full product.",
  },
  evidence_strength: {
    category: "evidence_strength",
    definition: "Whether enough independent, classified evidence exists to trust the assessment process itself.",
    minimumRequired: "At least 4 qualifying evidence items across at least 2 evidence classes.",
    accepts: ["public", "customer", "experiment"],
    minQualifying: 4,
    minKinds: 2,
    nextAction: "Add a mix of customer research, public sources, and completed experiments before relying on score outputs.",
    assumption: "Evidence quality matters more than generated assessment text.",
  },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitList(value?: string): string[] {
  return value?.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function textOf(item: EvidenceItem): string {
  return `${item.title} ${item.summary} ${item.sourceName} ${item.sourceType}`.toLowerCase();
}

function isFounderContext(item: EvidenceItem): boolean {
  const sourceType = item.sourceType.toLowerCase();
  return item.verifiedStatus === "user_provided" && (
    sourceType.includes("founder") ||
    sourceType.includes("assumption") ||
    sourceType.includes("manual context") ||
    sourceType.includes("user provided")
  );
}

function isGeneratedAssessment(item: EvidenceItem): boolean {
  const sourceType = item.sourceType.toLowerCase();
  return item.verifiedStatus === "inferred" || sourceType.includes("generated") || sourceType.includes("model assessment") || sourceType.includes("ai suggestion");
}

function evidenceKind(item: EvidenceItem): QualifyingKind | null {
  if (isFounderContext(item) || isGeneratedAssessment(item)) return null;
  const sourceType = item.sourceType.toLowerCase();
  const text = textOf(item);
  if (sourceType.includes("experiment") || text.includes("experiment result") || text.includes("completed experiment")) return "experiment";
  if (sourceType.includes("customer") || sourceType.includes("interview") || text.includes("customer interview") || text.includes("willingness to pay")) return "customer";
  if (item.verifiedStatus === "verified" || sourceType.includes("public") || sourceType.includes("competitor") || Boolean(item.sourceUrl)) return "public";
  return null;
}

function isRelevant(item: EvidenceItem, category: EvidenceCategory): boolean {
  if (item.evidenceCategory === category || item.evidenceCategory === "evidence_strength") return true;
  const text = textOf(item);
  const keywords: Record<EvidenceCategory, RegExp> = {
    problem_clarity: /problem|pain|workflow|manual|current workaround/,
    customer_urgency: /urgent|urgency|pain|severity|frequency|cost|risk|willingness/,
    existing_alternatives: /alternative|competitor|uses today|current tool|workaround/,
    competitor_saturation: /competitor|market map|alternative|saturation|crowded/,
    differentiation: /different|differentiation|unique|switch|positioning|advantage/,
    monetisation_potential: /pricing|paid|budget|willingness|checkout|revenue|subscription/,
    distribution_difficulty: /channel|outbound|waitlist|acquisition|response|lead/,
    market_timing: /timing|trend|regulation|growth|recent|now|market/,
    execution_complexity: /prototype|mvp|implementation|technical|manual workflow|experiment/,
    evidence_strength: /evidence|source|interview|experiment|research/,
  };
  return keywords[category].test(text);
}

function completedExperimentEquivalent(item: EvidenceItem): boolean {
  if (evidenceKind(item) !== "experiment") return false;
  const metadataStatus = typeof item.rawMetadata?.status === "string" ? item.rawMetadata.status.toLowerCase() : "";
  const metadataOutcome = typeof item.rawMetadata?.outcome === "string" ? item.rawMetadata.outcome.toLowerCase() : "";
  const text = textOf(item);
  if (metadataStatus === "planned" || text.includes("planned experiment")) return false;
  return metadataStatus === "completed" || metadataStatus === "closed" || Boolean(metadataOutcome) || text.includes("completed experiment") || text.includes("experiment result");
}

function acceptedByRule(item: EvidenceItem, rule: DimensionRule): boolean {
  const kind = evidenceKind(item);
  if (!kind || !rule.accepts.includes(kind)) return false;
  if (kind === "experiment" && !completedExperimentEquivalent(item)) return false;
  return isRelevant(item, rule.category);
}

function evidenceWeight(item: EvidenceItem): number {
  const quality = item.reliabilityScore >= 80 ? 1 : item.reliabilityScore >= 60 ? 0.75 : 0.45;
  const relevance = item.relevanceScore >= 80 ? 1 : item.relevanceScore >= 60 ? 0.75 : 0.5;
  const freshness = (() => {
    const dateValue = item.publishedOrRetrievedAt ?? item.accessedAt;
    const time = new Date(dateValue).getTime();
    if (!Number.isFinite(time)) return 0.7;
    const days = Math.max(0, (Date.now() - time) / 86_400_000);
    return Math.max(0.55, 1 - days / 730);
  })();
  return quality * relevance * freshness;
}

function component(
  componentName: string,
  normalizedValue: number | null,
  weight: number,
  evidenceKind: ScoreComponent["evidenceKind"],
  rawSignal: Record<string, unknown>,
): ScoreComponent {
  return {
    componentName,
    normalizedValue: normalizedValue === null ? null : clamp(normalizedValue),
    weight,
    contribution: normalizedValue === null ? null : Math.round(clamp(normalizedValue) * weight),
    evidenceKind,
    rawSignal,
  };
}

function scoreFromEvidence(supporting: EvidenceItem[], contradicting: EvidenceItem[]): number {
  const supportWeight = supporting.reduce((sum, item) => sum + evidenceWeight(item), 0);
  const contradictionWeight = contradicting.reduce((sum, item) => sum + evidenceWeight(item), 0);
  const totalWeight = supportWeight + contradictionWeight;
  if (totalWeight <= 0) return 50;
  const supportRatio = supportWeight / totalWeight;
  const sampleBonus = Math.min(12, (supporting.length + contradicting.length - 1) * 3);
  const contradictionPenalty = Math.min(20, contradictionWeight * 7);
  return clamp(18 + supportRatio * 70 + sampleBonus - contradictionPenalty);
}

function confidenceFor(qualifying: EvidenceItem[], kindCount: number): EvidenceConfidence {
  if (qualifying.length >= 6 && kindCount >= 2 && qualifying.some((item) => item.verifiedStatus === "verified")) return "high";
  if (qualifying.length >= 3 || kindCount >= 2) return "medium";
  return "low";
}

function sourceRefs(items: EvidenceItem[]) {
  return items.slice(0, 6).map((item) => ({ title: item.title, url: item.sourceUrl, sourceName: item.sourceName }));
}

function excludedSummary(founderContext: EvidenceItem[], generated: EvidenceItem[]): string[] {
  const items: string[] = [];
  if (founderContext.length) items.push(`${founderContext.length} founder context item${founderContext.length === 1 ? "" : "s"} excluded from independent-evidence weighting.`);
  if (generated.length) items.push(`${generated.length} generated assessment item${generated.length === 1 ? "" : "s"} excluded from independent-evidence weighting.`);
  return items;
}

export function calculateEvidenceScores(input: EvidenceEngineInput, evidence: EvidenceItem[]): CategoryScore[] {
  const now = new Date().toISOString();
  const founderClaims = [
    input.ideaDescription,
    input.targetCustomer,
    input.businessModel,
    input.knownCompetitors,
    input.mainAssumptions,
  ].flatMap((value) => splitList(value)).filter(Boolean);

  return (Object.keys(DIMENSION_RULES) as EvidenceCategory[]).map((category) => {
    const rule = DIMENSION_RULES[category];
    const relevant = evidence.filter((item) => isRelevant(item, category));
    const founderContext = relevant.filter(isFounderContext);
    const generated = relevant.filter(isGeneratedAssessment);
    const qualifying = evidence.filter((item) => acceptedByRule(item, rule));
    const supporting = qualifying.filter((item) => item.direction !== "contradicts");
    const contradicting = qualifying.filter((item) => item.direction === "contradicts");
    const kinds = new Set(qualifying.map((item) => evidenceKind(item)).filter(Boolean));
    const experimentCount = qualifying.filter((item) => evidenceKind(item) === "experiment").length;
    const hasEnoughCount = qualifying.length >= rule.minQualifying || experimentCount >= 1 && rule.accepts.includes("experiment") && rule.minQualifying > 1;
    const hasEnoughKinds = !rule.minKinds || kinds.size >= rule.minKinds;
    const assessable = hasEnoughCount && hasEnoughKinds && (supporting.length > 0 || contradicting.length > 0);
    const score = assessable ? scoreFromEvidence(supporting, contradicting) : null;
    const confidence = assessable ? confidenceFor(qualifying, kinds.size) : "low";
    const missingRequirements = assessable
      ? []
      : [
          rule.minimumRequired,
          ...(rule.minKinds && kinds.size < rule.minKinds ? [`Evidence must cover at least ${rule.minKinds} independent evidence classes.`] : []),
          ...(qualifying.length === 0 ? ["Founder context and generated assessments do not qualify as independent evidence."] : []),
        ];
    const components: ScoreComponent[] = assessable
      ? [
          component("Supporting qualifying evidence", Math.min(100, supporting.reduce((sum, item) => sum + evidenceWeight(item), 0) * 30), 0.35, supporting.some((item) => item.verifiedStatus === "verified") ? "verified" : "user_provided", { linkedEvidenceIds: supporting.map((item) => item.id), evidenceCount: supporting.length }),
          component("Contradicting qualifying evidence", Math.max(0, 100 - contradicting.reduce((sum, item) => sum + evidenceWeight(item), 0) * 35), 0.3, contradicting.length ? "user_provided" : "unavailable", { linkedEvidenceIds: contradicting.map((item) => item.id), evidenceCount: contradicting.length }),
          component("Evidence quality and freshness", Math.min(100, qualifying.reduce((sum, item) => sum + evidenceWeight(item), 0) / Math.max(1, qualifying.length) * 100), 0.2, qualifying.some((item) => item.verifiedStatus === "verified") ? "verified" : "user_provided", { evidenceCount: qualifying.length }),
          component("Minimum threshold satisfied", 100, 0.15, "verified", { minimumRequired: rule.minimumRequired, evidenceClasses: [...kinds] }),
        ]
      : [
          component("Minimum evidence threshold", null, 1, "unavailable", {
            minimumRequired: rule.minimumRequired,
            qualifyingEvidenceCount: qualifying.length,
            excludedFounderContextIds: founderContext.map((item) => item.id),
            excludedGeneratedAssessmentIds: generated.map((item) => item.id),
          }),
        ];

    return {
      category,
      label: CATEGORY_LABELS[category],
      score,
      assessmentStatus: assessable ? "assessed" : "unassessed",
      definition: rule.definition,
      confidence,
      conclusion: assessable
        ? `${CATEGORY_LABELS[category]} is scored from qualifying evidence only. The result remains provisional and does not prove market demand.`
        : "Insufficient evidence for scoring. Assessment not yet evidence-backed.",
      supportingEvidence: supporting.length ? supporting.map((item) => item.summary).slice(0, 5) : ["Insufficient evidence"],
      opposingEvidence: contradicting.map((item) => item.summary).slice(0, 5),
      qualifyingEvidenceIds: qualifying.map((item) => item.id),
      contradictingEvidenceIds: contradicting.map((item) => item.id),
      excludedEvidenceIds: [...founderContext, ...generated].map((item) => item.id),
      excludedEvidenceSummary: excludedSummary(founderContext, generated),
      missingRequirements,
      assumptions: [rule.assumption, ...founderClaims.slice(0, 2)],
      uncertainty: assessable
        ? "This dimension meets the minimum evidence threshold, but confidence still depends on evidence quality, freshness, and contradictions."
        : "No numerical score is shown because the minimum independent evidence threshold is not met.",
      sourceReferences: sourceRefs(qualifying),
      methodology: assessable
        ? `Calculated from qualifying ${rule.accepts.join(", ")} evidence using source quality, freshness, relevance, and supporting-versus-contradicting direction. Founder context and generated assessments have zero independent-evidence weight.`
        : `Not calculated. ${rule.minimumRequired} Founder context, assumptions, planned experiments, and generated assessments do not increase the score.`,
      recommendedNextAction: rule.nextAction,
      components,
      evidenceCoverage: {
        assessable,
        qualifyingEvidenceCount: qualifying.length,
        supportingEvidenceCount: supporting.length,
        contradictingEvidenceCount: contradicting.length,
        completedExperimentCount: experimentCount,
        excludedFounderContextCount: founderContext.length,
        excludedGeneratedAssessmentCount: generated.length,
        minimumRequired: rule.minimumRequired,
      },
      scoreVersion: SCORE_VERSION,
      calculatedAt: now,
    };
  });
}

export function overallValidationScore(scores: CategoryScore[]): { score: number | null; confidence: EvidenceConfidence; coverage: OverallEvidenceCoverage } {
  const assessed = scores.filter((item) => item.score !== null);
  const minimumAssessableDimensions = 6;
  const qualifiedEvidenceIds = new Set(scores.flatMap((item) => item.qualifyingEvidenceIds));
  const coverage: OverallEvidenceCoverage = {
    assessableDimensions: assessed.length,
    totalDimensions: scores.length,
    minimumAssessableDimensions,
    qualifiedEvidenceCount: qualifiedEvidenceIds.size,
    customerResearchCount: scores.reduce((sum, item) => sum + item.evidenceCoverage.supportingEvidenceCount, 0),
    completedExperimentCount: scores.reduce((sum, item) => sum + item.evidenceCoverage.completedExperimentCount, 0),
    verifiedPublicEvidenceCount: scores.flatMap((item) => item.sourceReferences).filter((item) => Boolean(item.url)).length,
    excludedFounderContextCount: scores.reduce((sum, item) => sum + item.evidenceCoverage.excludedFounderContextCount, 0),
    excludedGeneratedAssessmentCount: scores.reduce((sum, item) => sum + item.evidenceCoverage.excludedGeneratedAssessmentCount, 0),
    missingDimensions: scores.filter((item) => item.score === null).map((item) => item.label),
    statusLabel: assessed.length >= minimumAssessableDimensions ? "Evidence-backed score available" : "Insufficient evidence for scoring",
    summary: assessed.length >= minimumAssessableDimensions
      ? "Enough dimensions meet deterministic evidence thresholds to show an overall score."
      : "Assessment not yet evidence-backed. Review evidence coverage instead of a numeric score.",
  };
  if (assessed.length < minimumAssessableDimensions) return { score: null, confidence: "low", coverage };
  const score = clamp(assessed.reduce((sum, item) => sum + (item.score ?? 0), 0) / assessed.length);
  const high = assessed.filter((item) => item.confidence === "high").length;
  const medium = assessed.filter((item) => item.confidence === "medium").length;
  const confidence: EvidenceConfidence = high >= 4 ? "high" : medium + high >= 4 ? "medium" : "low";
  return { score, confidence, coverage };
}

export function suggestExperiments(input: EvidenceEngineInput, scores: CategoryScore[]): SuggestedExperiment[] {
  const weakest = [...scores].sort((a, b) => (a.score ?? -1) - (b.score ?? -1)).slice(0, 3);
  return weakest.map((score) => ({
    experimentType:
      score.category === "monetisation_potential"
        ? "pricing test"
        : score.category === "distribution_difficulty"
        ? "outbound message test"
        : score.category === "customer_urgency"
        ? "customer interviews"
        : "landing-page test",
    hypothesis: `${input.targetCustomer} will show measurable interest in ${input.startupName} if the core assumption behind ${score.label.toLowerCase()} is true.`,
    assumptionTested: score.assumptions[0] ?? `Assess ${score.label.toLowerCase()}.`,
    targetAudience: input.targetCustomer,
    steps: [
      "Define one measurable pass/fail metric before starting.",
      "Recruit a small but relevant sample from the target customer segment.",
      "Run the test without changing the offer mid-experiment.",
      "Record evidence links, notes, and exact numbers after completion.",
    ],
    estimatedTime: "3-7 days",
    estimatedCost: "Low, unless paid traffic is used",
    successMetric: score.category === "monetisation_potential" ? "Paid intent or checkout click rate" : "Qualified positive response rate",
    minimumSampleSize: score.category === "customer_urgency" ? 12 : 50,
    passThreshold: score.category === "customer_urgency" ? "At least 6 strong pain confirmations" : "At least 10% qualified positive signal",
    failThreshold: score.category === "customer_urgency" ? "Fewer than 3 strong pain confirmations" : "Under 3% qualified positive signal",
    status: "planned",
  }));
}
