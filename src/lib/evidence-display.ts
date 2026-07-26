import type { CategoryScore, EvidenceItem } from "./evidence-types";

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
