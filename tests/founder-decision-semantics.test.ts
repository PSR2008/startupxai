import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  STRATEGIC_INTERPRETATION_DISCLAIMER,
  buildDecisionActionHierarchy,
  buildDecisionCopyReport,
  calibrateDecisionText,
  getDecisionContextCompleteness,
} from "../src/lib/decision-display";
import { buildFounderReportContent, type StoredAnalysis } from "../src/lib/reporting";
import type { DecisionEngineOutput } from "../src/types";

const input = {
  idea: "OpsProof",
  description: "A workspace for operations founders to collect customer evidence before building.",
  targetAudience: "Seed-stage B2B SaaS founders",
  currentStatus: "Idea stage",
  biggestChallenge: "No customer interviews yet",
  resources: "Solo founder, limited budget",
};

const output: DecisionEngineOutput = {
  top3Priorities: [
    { rank: 1, priority: "Interview operations founders", why: "Based on founder context, this tests whether the reported workflow pain is frequent enough to matter.", timeframe: "Next 48 hours" },
    { rank: 2, priority: "Test a manual evidence workflow", why: "This assumption should be tested through a small concierge workflow with a measurable completion condition.", timeframe: "Next 14 days" },
    { rank: 3, priority: "Attach public competitor sources", why: "This checks alternatives before claiming differentiation.", timeframe: "Next 14 days" },
    { rank: 4, priority: "Extra priority should not render", why: "Too many priorities.", timeframe: "Later" },
  ],
  whatToFixFirst: "Investigate the first issue before building more product.",
  whatNotToBuildYet: ["Dashboard automation", "Team permissions", "Advanced exports"],
  biggestStrategicMistake: "This is your biggest mistake: assuming users will become paying customers without interviews.",
  fastestPathToTraction: "Run a 60-day window outbound test with 20 founders.",
  finalVerdict: "You are solving a real pain point and the market wants this.",
  founderSummary: "Based on your description, this is a useful assumption set to test.",
  actionableNextSteps: ["Interview 5 founders", "Show a manual workflow", "Ask for budget signal", "Build advanced analytics"],
};

test("Founder Decision UI removes arbitrary confidence score and final verdict language", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/founder-decision/page.tsx"), "utf8");
  assert.equal(page.includes("ScoreRing"), false);
  assert.equal(page.includes("Confidence Score"), false);
  assert.equal(page.includes("Final Verdict"), false);
  assert.match(page, /Context completeness/);
  assert.match(page, /Strategic interpretation/);
  assert.match(page, /Basis of this brief/);
  assert.match(page, /No independent evidence was included in this brief/);
  assert.match(page, /AI-assisted recommendation/);
  assert.match(page, /Edit inputs/);
  assert.match(page, /Run again/);
  assert.match(page, /max-w-6xl mx-auto/);
});

test("context completeness measures input coverage only and does not imply viability", () => {
  const completeness = getDecisionContextCompleteness(input);
  assert.equal(completeness.label, "Detailed context");
  assert.ok(completeness.suppliedReasons.includes("Product description supplied"));
  assert.ok(completeness.suppliedReasons.includes("Target customer supplied"));
  assert.ok(completeness.missingReasons.includes("No customer evidence connected"));
  assert.ok(completeness.missingReasons.includes("No revenue evidence connected"));
  assert.ok(completeness.missingReasons.includes("No experiment results connected"));
});

test("unsupported certainty and fabricated precise timeline language is calibrated", () => {
  const text = calibrateDecisionText("You are solving a real pain point. The market wants this. You have exactly 60 days. These users will become paying customers.");
  assert.doesNotMatch(text, /solving a real pain point|market wants this|exactly 60 days|will become paying customers/i);
  assert.match(text, /potential pain point|market demand still needs to be tested|time-boxed experiment|may become paying customers/i);
});

test("action hierarchy exposes one primary action and no more than two secondary actions", () => {
  const hierarchy = buildDecisionActionHierarchy(output, input);
  assert.ok(hierarchy.primary.exactAction.length > 0);
  assert.ok(hierarchy.primary.metric.length > 0);
  assert.ok(hierarchy.primary.completionCondition.length > 0);
  assert.equal(hierarchy.secondary.length, 2);
  assert.ok(hierarchy.laterParked.length > 0);
});

test("Founder Decision page uses corrected risk and action headings", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/founder-decision/page.tsx"), "utf8");
  assert.match(page, /Highest-risk assumption/);
  assert.match(page, /First issue to investigate/);
  assert.match(page, /Suggested traction experiment/);
  assert.match(page, /Features to postpone until core assumptions are tested/);
  assert.equal(page.includes("Biggest Mistake"), false);
  assert.equal(page.includes("Fastest Path to Traction"), false);
  assert.equal(page.includes("Do Not Build Yet"), false);
});

test("copy report uses corrected terminology and omits arbitrary confidence numbers", () => {
  const report = buildDecisionCopyReport(input, output);
  assert.match(report, /Strategic interpretation/);
  assert.match(report, new RegExp(STRATEGIC_INTERPRETATION_DISCLAIMER));
  assert.match(report, /Primary action - next 48 hours/);
  assert.match(report, /Secondary actions - next 14 days/);
  assert.match(report, /Highest-risk assumption/);
  assert.match(report, /Suggested traction experiment/);
  assert.match(report, /Features to postpone until core assumptions are tested/);
  assert.doesNotMatch(report, /Confidence Score|Final Verdict|Biggest Strategic Mistake|Fastest Path to Traction|Do Not Build Yet/);
});

test("generated Founder Decision reports use strategic interpretation terminology", () => {
  const analysis: StoredAnalysis = {
    id: "a1",
    user_id: "user_1",
    engine_type: "decision",
    input_data: input,
    output_data: output as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
  };
  const report = buildFounderReportContent(analysis, null, "detailed");
  const text = JSON.stringify(report.sections);
  assert.match(text, /Founder Decision Brief/);
  assert.match(text, /Strategic interpretation/);
  assert.doesNotMatch(text, /Confidence Score|Final Verdict/);
});

test("prompt safety prevents final verdict, confidence number, and unsupported proof claims", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/ai.ts"), "utf8");
  assert.match(source, /Do not present your reasoning as verified evidence/);
  assert.match(source, /Do not invent timelines, user counts, revenue, traction/);
  assert.match(source, /Do not claim:/);
  assert.equal(source.includes('"confidenceScore": <integer 0-100>'), false);
  assert.equal(source.includes("executive verdict on viability"), false);
});

test("billing, entitlements, auth, RLS and Evidence Engine scoring are not part of Founder Decision semantic change", () => {
  const source = [
    "src/app/(app)/founder-decision/page.tsx",
    "src/lib/ai.ts",
    "src/lib/decision-display.ts",
  ].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  assert.equal(source.includes("razorpay"), false);
  assert.equal(source.includes("user_roles"), false);
  assert.equal(source.includes("calculateEvidenceScores("), false);
});
