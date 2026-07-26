import type { CategoryScore, EvidenceItem, SuggestedExperiment, ValidationProjectResult } from "./evidence-types";

export const EVIDENCE_SCORE_DISCLAIMER =
  "This score reflects the evidence currently available. It does not prove market demand or guarantee business success.";

export type EvidenceDisplayClass =
  | "Verified public evidence"
  | "Public URL"
  | "Founder-provided evidence"
  | "Customer research"
  | "Experiment result"
  | "Assumption"
  | "Generated assessment";

export interface ScoreEvidenceMetrics {
  evidenceCount: number;
  evidenceQuality: "Strong" | "Moderate" | "Low" | "Insufficient";
  missingEvidence: string[];
  confidenceLevel: CategoryScore["confidence"];
  calculationSummary: string;
  improvementAction: string;
  insufficientEvidence: boolean;
}

export interface ConfidenceExplanation {
  label: string;
  summary: string;
  reasons: string[];
}

export interface ComponentCalculation {
  componentName: string;
  purpose: string;
  weightPercent: number;
  rawScore: number;
  weightedContribution: number;
  finalContribution: number;
  deductions: string[];
  reasonCodes: string[];
  linkedEvidenceIds: string[];
  missingEvidence: string[];
}

export interface EvidenceProvenanceItem {
  id: string;
  title: string;
  sourceLabel: string;
  direction: string;
  linkedClaim: string;
  attribution: string;
  hostname: string | null;
  retrievedAt: string | null;
  verificationStatus: string;
  resultImpact: string;
  publicNotesSafe: boolean;
}

export interface MissingEvidenceItem {
  title: string;
  whyItMatters: string;
  affectedAssumption: string;
  evidenceNeeded: string;
  confidenceImpact: string;
}

export interface RecommendedTestItem {
  hypothesis: string;
  test: string;
  targetAudience: string;
  metric: string;
  successThreshold: string;
  duration: string;
  evidenceType: string;
}

export function classifyEvidenceItem(item: EvidenceItem): EvidenceDisplayClass {
  const sourceType = item.sourceType.toLowerCase();
  const title = item.title.toLowerCase();

  if (sourceType === "public_url" || sourceType.includes("public url")) return "Public URL";
  if (sourceType.includes("customer") || sourceType.includes("interview")) return "Customer research";
  if (sourceType.includes("experiment") || sourceType.includes("test result")) return "Experiment result";
  if (sourceType.includes("assumption") || title.includes("assumption")) return "Assumption";
  if (item.verifiedStatus === "verified") return "Verified public evidence";
  if (item.verifiedStatus === "user_provided") return "Founder-provided evidence";
  return "Generated assessment";
}

function publicHostname(item: EvidenceItem): string | null {
  const metadataHostname = typeof item.rawMetadata?.hostname === "string" ? item.rawMetadata.hostname : null;
  if (metadataHostname) return metadataHostname;
  if (!item.sourceUrl) return null;
  try {
    return new URL(item.sourceUrl).hostname;
  } catch {
    return null;
  }
}

function evidenceMatchesScore(item: EvidenceItem, score: CategoryScore) {
  return item.evidenceCategory === score.category || item.evidenceCategory === "evidence_strength";
}

function linkedEvidenceIds(component: CategoryScore["components"][number]): string[] {
  const value = component.rawSignal.linkedEvidenceIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getConfidenceExplanation(result: ValidationProjectResult): ConfidenceExplanation {
  const evidence = result.evidenceItems;
  const verified = evidence.filter((item) => item.verifiedStatus === "verified").length;
  const founderProvided = evidence.filter((item) => item.verifiedStatus === "user_provided").length;
  const publicSources = evidence.filter((item) => classifyEvidenceItem(item) === "Verified public evidence" || classifyEvidenceItem(item) === "Public URL").length;
  const customerResearch = evidence.filter((item) => classifyEvidenceItem(item) === "Customer research").length;
  const experimentResults = evidence.filter((item) => classifyEvidenceItem(item) === "Experiment result").length;
  const unavailableComponents = result.scores.flatMap((score) => score.components).filter((component) => component.evidenceKind === "unavailable").length;
  const contradictions = evidence.filter((item) => item.direction === "contradicts").length;
  const duplicateHosts = new Map<string, number>();
  evidence.forEach((item) => {
    const host = publicHostname(item);
    if (host) duplicateHosts.set(host, (duplicateHosts.get(host) ?? 0) + 1);
  });

  const reasons: string[] = [];
  if (evidence.length === 0) reasons.push("No evidence items were available beyond founder input.");
  if (founderProvided > 0 && founderProvided >= verified + publicSources + customerResearch + experimentResults) {
    reasons.push("Most evidence is founder provided rather than independently attributed.");
  }
  if (customerResearch === 0) reasons.push("No customer interviews or customer-research evidence are recorded.");
  if (experimentResults === 0) reasons.push("No completed experiment outcomes are recorded.");
  if (publicSources < 2) reasons.push(`${publicSources} independent public source${publicSources === 1 ? " is" : "s are"} attached.`);
  if (unavailableComponents > 0) reasons.push(`${unavailableComponents} weighted score input${unavailableComponents === 1 ? " is" : "s are"} unavailable.`);
  if (contradictions > 0) reasons.push(`${contradictions} contradicting evidence item${contradictions === 1 ? "" : "s"} need resolution.`);
  if ([...duplicateHosts.values()].some((count) => count > 1)) reasons.push("Multiple evidence items depend on the same public host.");
  if (reasons.length === 0) reasons.push("Available evidence covers the main weighted inputs, but the assessment is still not proof of market demand.");

  const summary =
    result.project.confidence === "low"
      ? `This assessment has low evidence confidence because ${reasons[0].toLowerCase()}`
      : result.project.confidence === "medium"
      ? `This assessment has medium evidence confidence because some evidence is available, but ${reasons[0].toLowerCase()}`
      : `This assessment has high evidence confidence for the currently available evidence, but it still does not prove market demand or business success.`;

  return {
    label: `Evidence confidence: ${result.project.confidence[0].toUpperCase()}${result.project.confidence.slice(1)}`,
    summary,
    reasons,
  };
}

export function getComponentCalculations(score: CategoryScore): ComponentCalculation[] {
  const base = score.components.map((component) => {
    const weightPercent = Math.round(component.weight * 100);
    const weightedContribution = Math.round(component.normalizedValue * component.weight);
    const missingEvidence = component.evidenceKind === "unavailable" ? [component.componentName] : [];
    const deductions: string[] = [];
    if (component.evidenceKind === "unavailable") deductions.push("Unavailable input limits confidence for this component.");
    if (component.evidenceKind === "user_provided") deductions.push("Founder-provided input is useful context but not independent proof.");
    if (component.evidenceKind === "inferred") deductions.push("Inferred signal is weighted cautiously because it is not direct evidence.");
    if (component.normalizedValue < 45) deductions.push("Low raw component result reduced the total.");
    return {
      componentName: component.componentName,
      purpose: `${component.componentName} contributes to ${score.label.toLowerCase()}.`,
      weightPercent,
      rawScore: component.normalizedValue,
      weightedContribution,
      finalContribution: component.contribution,
      deductions,
      reasonCodes: [component.evidenceKind, ...(missingEvidence.length ? ["missing_evidence"] : [])],
      linkedEvidenceIds: linkedEvidenceIds(component),
      missingEvidence,
    };
  });
  const delta = score.score - base.reduce((sum, item) => sum + item.finalContribution, 0);
  if (base.length && delta !== 0) {
    const last = base[base.length - 1];
    base[base.length - 1] = {
      ...last,
      finalContribution: last.finalContribution + delta,
      deductions: [...last.deductions, `Rounded reconciliation adjusted this displayed contribution by ${delta > 0 ? "+" : ""}${delta}.`],
    };
  }
  return base;
}

export function getDisplayedTotal(score: CategoryScore): number {
  return getComponentCalculations(score).reduce((sum, component) => sum + component.finalContribution, 0);
}

export function getEvidenceProvenance(items: EvidenceItem[], score?: CategoryScore): EvidenceProvenanceItem[] {
  const filtered = score ? items.filter((item) => evidenceMatchesScore(item, score)) : items;
  return filtered.map((item) => {
    const sourceLabel = classifyEvidenceItem(item);
    const claim = typeof item.rawMetadata?.claim === "string" ? item.rawMetadata.claim : item.summary;
    const attribution =
      sourceLabel === "Verified public evidence" || sourceLabel === "Public URL"
        ? "Public source - founder selected"
        : sourceLabel === "Generated assessment"
        ? "AI suggestion - unverified"
        : sourceLabel;
    return {
      id: item.id,
      title: item.title,
      sourceLabel,
      direction: item.direction,
      linkedClaim: claim || "No linked claim recorded",
      attribution,
      hostname: publicHostname(item),
      retrievedAt: item.publishedOrRetrievedAt ?? item.accessedAt ?? null,
      verificationStatus: sourceLabel === "Generated assessment" ? "unverified" : item.verifiedStatus.replace("_", " "),
      resultImpact:
        item.direction === "contradicts"
          ? "Reduced confidence or highlighted an unresolved contradiction."
          : item.direction === "supports"
          ? "Supported one or more weighted assumptions."
          : "Kept as context without strongly moving the score.",
      publicNotesSafe: sourceLabel === "Verified public evidence" || sourceLabel === "Public URL",
    };
  });
}

export function getMissingEvidenceItems(score: CategoryScore): MissingEvidenceItem[] {
  const missingComponents = score.components.filter((component) => component.evidenceKind === "unavailable");
  const hasAnyAvailableInput = score.components.some((component) => component.evidenceKind !== "unavailable");
  const fallback = score.confidence === "low" && !hasAnyAvailableInput ? score.components.slice(0, 2) : [];
  const source = missingComponents.length ? missingComponents : fallback;
  return source.slice(0, 5).map((component) => ({
    title: component.componentName,
    whyItMatters: `${component.componentName} is a weighted input for ${score.label.toLowerCase()}.`,
    affectedAssumption: score.assumptions[0] ?? `Assess ${score.label.toLowerCase()}.`,
    evidenceNeeded:
      /experiment|test|technical proof/i.test(component.componentName)
        ? "Completed experiment result"
        : /customer|urgency|complaint/i.test(component.componentName)
        ? "Customer research"
        : /website|competitor|trend|pricing|public/i.test(component.componentName)
        ? "Independent public source"
        : "Relevant evidence linked to the assumption",
    confidenceImpact: "Completing this can raise confidence only if the evidence is relevant, independent, recent and high quality.",
  }));
}

export function getConfidenceImprovementItems(score: CategoryScore): string[] {
  const missing = getMissingEvidenceItems(score);
  const items = missing.map((item) => `Add ${item.evidenceNeeded.toLowerCase()} for ${item.affectedAssumption}`);
  if (score.opposingEvidence.length > 0) items.push("Resolve contradicting evidence before treating the score as reliable.");
  if (!items.some((item) => /customer/i.test(item))) items.push("Add three customer interviews linked to the riskiest assumption.");
  if (!items.some((item) => /experiment/i.test(item))) items.push("Complete one experiment with a recorded outcome and decision.");
  items.push("More evidence does not automatically mean stronger evidence. Relevance, independence and experiment quality also matter.");
  return [...new Set(items)].slice(0, 6);
}

export function getRecommendedTests(scores: CategoryScore[], experiments: SuggestedExperiment[]): RecommendedTestItem[] {
  const weakest = [...scores].sort((a, b) => a.score - b.score).slice(0, 3);
  return weakest.map((score, index) => {
    const experiment = experiments.find((item) => item.assumptionTested === score.assumptions[0]) ?? experiments[index];
    return {
      hypothesis: experiment?.hypothesis ?? `${score.label} will improve after the riskiest assumption is tested.`,
      test: experiment?.experimentType ?? "structured evidence test",
      targetAudience: experiment?.targetAudience ?? "Target customer segment",
      metric: experiment?.successMetric ?? "Qualified positive signal rate",
      successThreshold: experiment?.passThreshold ?? "Define a pass threshold before running the test.",
      duration: experiment?.estimatedTime ?? "3-7 days",
      evidenceType:
        score.category === "customer_urgency"
          ? "Customer research"
          : score.category === "monetisation_potential"
          ? "Experiment result"
          : "Founder-provided evidence plus public source",
    };
  });
}

export function getScoreEvidenceMetrics(score: CategoryScore): ScoreEvidenceMetrics {
  const evidenceComponents = score.components.filter((component) => component.evidenceKind !== "unavailable");
  const missingEvidence = score.components
    .filter((component) => component.evidenceKind === "unavailable")
    .map((component) => component.componentName);
  const evidenceCount = score.supportingEvidence.filter((item) => !/insufficient evidence|insufficient public evidence/i.test(item)).length
    + score.opposingEvidence.length
    + evidenceComponents.length;
  const verifiedWeight = score.components
    .filter((component) => component.evidenceKind === "verified")
    .reduce((sum, component) => sum + component.weight, 0);
  const founderWeight = score.components
    .filter((component) => component.evidenceKind === "user_provided")
    .reduce((sum, component) => sum + component.weight, 0);
  const availableWeight = score.components
    .filter((component) => component.evidenceKind !== "unavailable")
    .reduce((sum, component) => sum + component.weight, 0);

  const evidenceQuality: ScoreEvidenceMetrics["evidenceQuality"] =
    verifiedWeight >= 0.4 ? "Strong" :
    verifiedWeight > 0 || founderWeight >= 0.45 ? "Moderate" :
    availableWeight > 0.5 ? "Low" :
    "Insufficient";

  return {
    evidenceCount,
    evidenceQuality,
    missingEvidence,
    confidenceLevel: score.confidence,
    calculationSummary: score.methodology,
    improvementAction: missingEvidence.length
      ? `Add evidence for ${missingEvidence.slice(0, 3).join(", ")}.`
      : score.recommendedNextAction,
    insufficientEvidence: score.confidence === "low" || evidenceQuality === "Insufficient" || evidenceCount < 3,
  };
}
