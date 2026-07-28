import type { DecisionEngineOutput } from "@/types";

export interface DecisionContextInput {
  idea: string;
  description: string;
  targetAudience: string;
  currentStatus?: string;
  biggestChallenge?: string;
  resources?: string;
}

export interface ContextCompleteness {
  label: "Limited context" | "Moderate context" | "Detailed context";
  suppliedReasons: string[];
  missingReasons: string[];
}

export interface StructuredDecisionAction {
  objective: string;
  exactAction: string;
  targetAudience: string;
  metric: string;
  completionCondition: string;
}

export interface DecisionActionHierarchy {
  primary: StructuredDecisionAction;
  secondary: StructuredDecisionAction[];
  laterParked: string[];
}

export const STRATEGIC_INTERPRETATION_DISCLAIMER =
  "This interpretation is generated from the context you provided. It is not independent market validation or a prediction of business success.";

export const DECISION_LIMITATION =
  "This brief cannot independently determine market demand, willingness to pay, customer urgency or product viability unless relevant evidence is supplied.";

export const DECISION_EXPERIMENT_LIMITATION = "Recommended actions are experiments, not predictions.";

function present(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getDecisionContextCompleteness(input: DecisionContextInput): ContextCompleteness {
  const suppliedReasons = [
    present(input.idea) ? "Startup idea supplied" : null,
    present(input.description) ? "Product description supplied" : null,
    present(input.targetAudience) ? "Target customer supplied" : null,
    present(input.currentStatus) ? "Current status supplied" : null,
    present(input.biggestChallenge) ? "Constraint or challenge supplied" : null,
    present(input.resources) ? "Resources and constraints supplied" : null,
  ].filter((item): item is string => Boolean(item));

  const missingReasons = [
    !present(input.currentStatus) ? "Current status not supplied" : null,
    !present(input.biggestChallenge) ? "Primary constraint not supplied" : null,
    !present(input.resources) ? "Resources and constraints not supplied" : null,
    "No customer evidence connected",
    "No revenue evidence connected",
    "No experiment results connected",
  ].filter((item): item is string => Boolean(item));

  const label =
    suppliedReasons.length >= 5 ? "Detailed context" :
    suppliedReasons.length >= 4 ? "Moderate context" :
    "Limited context";

  return { label, suppliedReasons, missingReasons };
}

export function calibrateDecisionText(value?: string | null): string {
  return (value ?? "")
    .replace(/\byou are solving a real pain point\b/gi, "your description points to a potential pain point to test")
    .replace(/\bthe product is solving a real pain point\b/gi, "the product may address a pain point that still needs evidence")
    .replace(/\bthe market wants this\b/gi, "market demand still needs to be tested")
    .replace(/\bthis will work\b/gi, "this may work if the riskiest assumptions are tested")
    .replace(/\bthese users will become paying customers\b/gi, "these users may become paying customers if willingness to pay is proven")
    .replace(/\bthis is your biggest mistake\b/gi, "a high-risk assumption to investigate")
    .replace(/\byou have exactly\s+\d+\s+days\b/gi, "you should define a time-boxed experiment")
    .replace(/\b\d+\s*-\s*day window\b/gi, "time-boxed test window");
}

function actionFromText(text: string, input: DecisionContextInput): StructuredDecisionAction {
  return {
    objective: "Reduce uncertainty around the riskiest assumption",
    exactAction: calibrateDecisionText(text || "Run one focused customer or demand test."),
    targetAudience: input.targetAudience || "Target customer segment",
    metric: "Number of qualified responses, completed interviews, or explicit objections recorded",
    completionCondition: "A dated result is recorded with the sample size, pass/fail threshold, learning, and next decision.",
  };
}

export function buildDecisionActionHierarchy(output: DecisionEngineOutput, input: DecisionContextInput): DecisionActionHierarchy {
  const steps = (output.actionableNextSteps ?? []).map(calibrateDecisionText).filter(Boolean);
  const fallback = output.fastestPathToTraction || output.whatToFixFirst || "Interview target customers about the most important unsolved workflow.";
  const primary = actionFromText(steps[0] ?? fallback, input);
  const secondary = (steps.length > 1 ? steps.slice(1, 3) : [output.whatToFixFirst, output.fastestPathToTraction])
    .filter((item): item is string => Boolean(item))
    .slice(0, 2)
    .map((item) => actionFromText(item, input));
  const laterParked = [
    ...steps.slice(3),
    ...(output.whatNotToBuildYet ?? []).map((item) => `Postpone: ${calibrateDecisionText(item)}`),
  ].slice(0, 6);
  return { primary, secondary, laterParked };
}

export function buildDecisionCopyReport(input: DecisionContextInput, output: DecisionEngineOutput): string {
  const completeness = getDecisionContextCompleteness(input);
  const hierarchy = buildDecisionActionHierarchy(output, input);
  const priorities = (output.top3Priorities ?? []).slice(0, 3);

  return [
    "StartupX AI - Founder Decision Brief",
    "",
    "Basis of this brief",
    "Founder-provided context:",
    `- Startup idea: ${input.idea}`,
    `- Product description: ${input.description}`,
    `- Target audience: ${input.targetAudience}`,
    input.currentStatus ? `- Current status: ${input.currentStatus}` : "- Current status: Not supplied",
    input.biggestChallenge ? `- Constraints and goals: ${input.biggestChallenge}` : "- Constraints and goals: Not supplied",
    input.resources ? `- Resources: ${input.resources}` : "- Resources: Not supplied",
    "Independent evidence: No independent evidence was included in this brief.",
    "AI contribution: interpretation, prioritisation suggestions, risks to test, action-plan drafting.",
    "",
    `Context completeness: ${completeness.label}`,
    "",
    "Strategic interpretation",
    STRATEGIC_INTERPRETATION_DISCLAIMER,
    calibrateDecisionText(output.finalVerdict || output.founderSummary),
    "",
    "Primary action - next 48 hours",
    `Objective: ${hierarchy.primary.objective}`,
    `Exact action: ${hierarchy.primary.exactAction}`,
    `Target audience: ${hierarchy.primary.targetAudience}`,
    `Metric: ${hierarchy.primary.metric}`,
    `Completion condition: ${hierarchy.primary.completionCondition}`,
    "",
    "Secondary actions - next 14 days",
    ...hierarchy.secondary.map((action, index) => `${index + 1}. ${action.exactAction} Metric: ${action.metric}`),
    "",
    "Top three priorities",
    ...priorities.map((priority) => `${priority.rank}. ${calibrateDecisionText(priority.priority)} - ${calibrateDecisionText(priority.why)} Completion condition: Record measurable evidence and next decision.`),
    "",
    "Highest-risk assumption",
    calibrateDecisionText(output.biggestStrategicMistake),
    "",
    "Suggested traction experiment",
    calibrateDecisionText(output.fastestPathToTraction),
    "",
    "Features to postpone until core assumptions are tested",
    ...(output.whatNotToBuildYet ?? []).map((item) => `- ${calibrateDecisionText(item)}`),
    "",
    "Limitations",
    DECISION_LIMITATION,
    DECISION_EXPERIMENT_LIMITATION,
  ].filter(Boolean).join("\n");
}
