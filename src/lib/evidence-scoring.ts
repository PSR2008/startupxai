import type {
  CategoryScore,
  EvidenceCategory,
  EvidenceConfidence,
  EvidenceEngineInput,
  EvidenceItem,
  ScoreComponent,
  SuggestedExperiment,
} from "./evidence-types";

export const SCORE_VERSION = "sx-evidence-v1";

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

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function words(value?: string): number {
  return value?.trim().split(/\s+/).filter(Boolean).length ?? 0;
}

function splitList(value?: string): string[] {
  return value?.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function confidenceFromEvidence(evidence: EvidenceItem[]): EvidenceConfidence {
  const verified = evidence.filter((item) => item.verifiedStatus === "verified").length;
  if (verified >= 3) return "high";
  if (verified >= 1 || evidence.length >= 5) return "medium";
  return "low";
}

function component(componentName: string, normalizedValue: number, weight: number, evidenceKind: ScoreComponent["evidenceKind"], rawSignal: Record<string, unknown>): ScoreComponent {
  return {
    componentName,
    normalizedValue: clamp(normalizedValue),
    weight,
    contribution: Math.round(clamp(normalizedValue) * weight),
    evidenceKind,
    rawSignal,
  };
}

function weightedScore(components: ScoreComponent[]): number {
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0) || 1;
  return clamp(components.reduce((sum, item) => sum + item.normalizedValue * item.weight, 0) / totalWeight);
}

function refs(evidence: EvidenceItem[], category: EvidenceCategory) {
  return evidence
    .filter((item) => item.evidenceCategory === category || item.evidenceCategory === "evidence_strength")
    .slice(0, 5)
    .map((item) => ({ title: item.title, url: item.sourceUrl, sourceName: item.sourceName }));
}

function supporting(evidence: EvidenceItem[], category: EvidenceCategory): string[] {
  const items = evidence.filter((item) => item.evidenceCategory === category && item.direction !== "contradicts");
  return items.length ? items.map((item) => item.summary).slice(0, 4) : ["Insufficient public evidence found."];
}

function opposing(evidence: EvidenceItem[], category: EvidenceCategory): string[] {
  return evidence.filter((item) => item.evidenceCategory === category && item.direction === "contradicts").map((item) => item.summary).slice(0, 3);
}

function scoreConclusion(score: number, label: string, confidence: EvidenceConfidence): string {
  if (score >= 70) return `${label} looks relatively strong, but confidence is ${confidence} because the score only uses currently available evidence.`;
  if (score >= 45) return `${label} is plausible but not yet proven; the next step should increase evidence quality.`;
  return `${label} is weakly supported by current evidence. Treat this as a validation gap, not a final verdict.`;
}

export function calculateEvidenceScores(input: EvidenceEngineInput, evidence: EvidenceItem[]): CategoryScore[] {
  const competitorCount = splitList(input.knownCompetitors).length;
  const assumptionCount = splitList(input.mainAssumptions).length;
  const verifiedCount = evidence.filter((item) => item.verifiedStatus === "verified").length;
  const userEvidenceCount = evidence.filter((item) => item.verifiedStatus === "user_provided").length;
  const websiteEvidence = evidence.some((item) => item.sourceType === "public company page");
  const competitorEvidence = evidence.filter((item) => item.sourceType === "competitor website").length;
  const descriptionWords = words(input.ideaDescription);
  const customerWords = words(input.targetCustomer);
  const businessModelWords = words(input.businessModel);
  const stageSpecificity = input.developmentStage && input.developmentStage !== "idea" ? 70 : 45;

  const definitions: Array<{
    category: EvidenceCategory;
    components: ScoreComponent[];
    nextAction: string;
    assumptions: string[];
  }> = [
    {
      category: "problem_clarity",
      components: [
        component("Problem description specificity", Math.min(descriptionWords * 3, 100), 0.45, "user_provided", { words: descriptionWords }),
        component("Target customer specificity", Math.min(customerWords * 5, 100), 0.35, "user_provided", { words: customerWords }),
        component("Verified website context", websiteEvidence ? 75 : 15, 0.2, websiteEvidence ? "verified" : "unavailable", { websiteEvidence }),
      ],
      nextAction: "Interview 8-12 target customers and record exact problem language before building more product.",
      assumptions: ["The founder's problem statement reflects a real customer problem."],
    },
    {
      category: "customer_urgency",
      components: [
        component("Urgency language in assumptions", /urgent|manual|waste|cost|slow|pain|risk|lost/i.test(input.mainAssumptions ?? input.ideaDescription) ? 65 : 35, 0.45, "inferred", { assumptions: input.mainAssumptions }),
        component("Target customer specificity", Math.min(customerWords * 5, 100), 0.25, "user_provided", { words: customerWords }),
        component("Public complaint evidence", 0, 0.3, "unavailable", { reason: "No complaint source provider configured" }),
      ],
      nextAction: "Run problem interviews and capture frequency, current workaround, budget owner, and switching trigger.",
      assumptions: ["Customers experience the problem often enough to prioritize it."],
    },
    {
      category: "existing_alternatives",
      components: [
        component("Founder-listed alternatives", Math.min(competitorCount * 18, 100), 0.4, competitorCount ? "user_provided" : "unavailable", { competitorCount }),
        component("Verified competitor pages", Math.min(competitorEvidence * 25, 100), 0.35, competitorEvidence ? "verified" : "unavailable", { competitorEvidence }),
        component("Business model category maturity", businessModelWords ? 55 : 20, 0.25, businessModelWords ? "user_provided" : "unavailable", { businessModel: input.businessModel }),
      ],
      nextAction: "Add competitor URLs and pricing pages so alternatives can be verified instead of inferred.",
      assumptions: ["Listed competitors are actually used by the target customer."],
    },
    {
      category: "competitor_saturation",
      components: [
        component("Direct alternative count", competitorCount >= 5 ? 35 : competitorCount >= 2 ? 60 : 75, 0.45, competitorCount ? "user_provided" : "unavailable", { competitorCount }),
        component("Verified competitor count", competitorEvidence >= 4 ? 40 : competitorEvidence >= 1 ? 62 : 50, 0.35, competitorEvidence ? "verified" : "unavailable", { competitorEvidence }),
        component("Positioning similarity", 50, 0.2, "unavailable", { reason: "Feature overlap provider not configured" }),
      ],
      nextAction: "Build a feature and positioning matrix from verified competitor pages before deciding positioning.",
      assumptions: ["A lower saturation score is better for a new entrant."],
    },
    {
      category: "differentiation",
      components: [
        component("Specificity of product claim", Math.min(descriptionWords * 2.5, 100), 0.35, "user_provided", { words: descriptionWords }),
        component("Startup website positioning evidence", websiteEvidence ? 65 : 20, 0.25, websiteEvidence ? "verified" : "unavailable", { websiteEvidence }),
        component("Known alternatives pressure", competitorCount ? Math.max(20, 80 - competitorCount * 8) : 45, 0.25, competitorCount ? "inferred" : "unavailable", { competitorCount }),
        component("Proprietary advantage evidence", /data|workflow|integration|network|proprietary|automated/i.test(input.ideaDescription) ? 60 : 30, 0.15, "inferred", { description: input.ideaDescription }),
      ],
      nextAction: "Write a one-sentence differentiation claim and test whether buyers can repeat it back.",
      assumptions: ["The stated workflow or positioning is meaningfully different to buyers."],
    },
    {
      category: "monetisation_potential",
      components: [
        component("Business model clarity", Math.min(businessModelWords * 10, 100), 0.45, "user_provided", { words: businessModelWords }),
        component("Paid alternative signal", competitorCount > 0 ? 58 : 25, 0.3, competitorCount ? "inferred" : "unavailable", { competitorCount }),
        component("Pricing evidence", 0, 0.25, "unavailable", { reason: "Verified pricing extraction not configured" }),
      ],
      nextAction: "Run a pricing test with a concrete package, price, and pass/fail threshold.",
      assumptions: ["The stated buyer has budget and authority to pay."],
    },
    {
      category: "distribution_difficulty",
      components: [
        component("Target geography specificity", Math.min(words(input.targetGeography) * 20, 80), 0.25, "user_provided", { targetGeography: input.targetGeography }),
        component("Target customer specificity", Math.min(customerWords * 5, 100), 0.35, "user_provided", { words: customerWords }),
        component("Competition pressure", competitorCount ? Math.max(25, 75 - competitorCount * 7) : 45, 0.25, "inferred", { competitorCount }),
        component("Channel evidence", 0, 0.15, "unavailable", { reason: "No channel performance evidence provided" }),
      ],
      nextAction: "Choose one acquisition channel and run a 7-day outbound or waitlist experiment.",
      assumptions: ["The target customer can be reached through a repeatable channel."],
    },
    {
      category: "market_timing",
      components: [
        component("Stage readiness", stageSpecificity, 0.3, "user_provided", { stage: input.developmentStage }),
        component("Industry specificity", input.industry ? 55 : 20, 0.25, input.industry ? "user_provided" : "unavailable", { industry: input.industry }),
        component("Trend evidence", 0, 0.45, "unavailable", { reason: "No permitted trend provider configured" }),
      ],
      nextAction: "Collect recent source links showing why this problem is more urgent now than 12 months ago.",
      assumptions: ["The market timing claim can be validated with recent evidence."],
    },
    {
      category: "execution_complexity",
      components: [
        component("Scope complexity from description", descriptionWords > 80 ? 40 : descriptionWords > 35 ? 60 : 70, 0.35, "inferred", { words: descriptionWords }),
        component("Stage readiness", stageSpecificity, 0.25, "user_provided", { stage: input.developmentStage }),
        component("Assumption load", assumptionCount >= 5 ? 35 : assumptionCount >= 2 ? 55 : 65, 0.25, assumptionCount ? "user_provided" : "unavailable", { assumptionCount }),
        component("Technical proof evidence", 0, 0.15, "unavailable", { reason: "No prototype or experiment result attached" }),
      ],
      nextAction: "Cut scope to the smallest concierge MVP that can test the riskiest assumption.",
      assumptions: ["The team can execute the first validation test without building the full product."],
    },
    {
      category: "evidence_strength",
      components: [
        component("Verified evidence count", Math.min(verifiedCount * 18, 100), 0.45, verifiedCount ? "verified" : "unavailable", { verifiedCount }),
        component("Founder-provided evidence count", Math.min(userEvidenceCount * 12, 80), 0.25, "user_provided", { userEvidenceCount }),
        component("Assumption clarity", Math.min(assumptionCount * 18, 100), 0.2, assumptionCount ? "user_provided" : "unavailable", { assumptionCount }),
        component("Contradictory evidence coverage", 0, 0.1, "unavailable", { reason: "No opposing source provider configured" }),
      ],
      nextAction: "Add at least five independent source links or experiment results before making a build decision.",
      assumptions: ["Evidence quality matters more than a high AI-generated score."],
    },
  ];

  const now = new Date().toISOString();
  return definitions.map((definition) => {
    const score = weightedScore(definition.components);
    const confidence = confidenceFromEvidence(evidence.filter((item) => item.evidenceCategory === definition.category || item.evidenceCategory === "evidence_strength"));
    const label = CATEGORY_LABELS[definition.category];
    const unavailable = definition.components.filter((item) => item.evidenceKind === "unavailable").length;
    return {
      category: definition.category,
      label,
      score,
      confidence,
      conclusion: scoreConclusion(score, label, confidence),
      supportingEvidence: supporting(evidence, definition.category),
      opposingEvidence: opposing(evidence, definition.category),
      assumptions: definition.assumptions,
      uncertainty: unavailable
        ? `${unavailable} weighted signal(s) are unavailable, so this score should be treated as provisional.`
        : "All weighted signals used for this score were available.",
      sourceReferences: refs(evidence, definition.category),
      methodology: `Calculated with ${definition.components.length} weighted signal(s). Verified evidence, user-provided claims, inferred signals, and unavailable data are labeled separately.`,
      recommendedNextAction: definition.nextAction,
      components: definition.components,
      scoreVersion: SCORE_VERSION,
      calculatedAt: now,
    };
  });
}

export function overallValidationScore(scores: CategoryScore[]): { score: number; confidence: EvidenceConfidence } {
  const score = clamp(scores.reduce((sum, item) => sum + item.score, 0) / (scores.length || 1));
  const high = scores.filter((item) => item.confidence === "high").length;
  const medium = scores.filter((item) => item.confidence === "medium").length;
  const confidence: EvidenceConfidence = high >= 4 ? "high" : medium + high >= 4 ? "medium" : "low";
  return { score, confidence };
}

export function suggestExperiments(input: EvidenceEngineInput, scores: CategoryScore[]): SuggestedExperiment[] {
  const weakest = [...scores].sort((a, b) => a.score - b.score).slice(0, 3);
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
    assumptionTested: score.assumptions[0] ?? `Validate ${score.label.toLowerCase()}.`,
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
