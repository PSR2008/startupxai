import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EVIDENCE_SCORE_DISCLAIMER, classifyEvidenceItem, getScoreEvidenceMetrics } from "../src/lib/evidence-display";
import { calculateEvidenceScores, overallValidationScore, suggestExperiments } from "../src/lib/evidence-scoring";
import type { EvidenceEngineInput, EvidenceItem } from "../src/lib/evidence-types";
import { normalizeHttpUrl } from "../src/lib/safe-url";

const input: EvidenceEngineInput = {
  startupName: "ProofDesk",
  ideaDescription: "A SaaS platform that helps B2B founders collect customer proof, competitor evidence, and validation experiments before building.",
  targetCustomer: "Seed-stage B2B SaaS founders selling to operations teams",
  targetGeography: "United States and India",
  businessModel: "Monthly subscription with founder and team tiers",
  industry: "SaaS",
  developmentStage: "mvp",
  knownCompetitors: "Airtable, Notion, https://example.com",
  mainAssumptions: "Founders waste time building before validation, buyers want proof workflows, competitor evidence changes positioning",
  websiteUrl: "https://example.com",
};

const evidence: EvidenceItem[] = [
  {
    id: "ev_1",
    evidenceCategory: "differentiation",
    title: "Website metadata",
    summary: "Public positioning page retrieved.",
    sourceName: "example.com",
    sourceUrl: "https://example.com",
    sourceType: "public company page",
    accessedAt: new Date().toISOString(),
    relevanceScore: 74,
    reliabilityScore: 70,
    sentiment: "neutral",
    direction: "supports",
    verifiedStatus: "verified",
  },
  {
    id: "ev_2",
    evidenceCategory: "problem_clarity",
    title: "Founder problem statement",
    summary: input.ideaDescription,
    sourceName: "Founder input",
    sourceType: "founder-provided evidence",
    accessedAt: new Date().toISOString(),
    relevanceScore: 70,
    reliabilityScore: 45,
    sentiment: "neutral",
    direction: "supports",
    verifiedStatus: "user_provided",
  },
];

test("calculateEvidenceScores returns transparent category scores", () => {
  const scores = calculateEvidenceScores(input, evidence);
  assert.equal(scores.length, 10);
  assert.ok(scores.every((score) => score.score >= 0 && score.score <= 100));
  assert.ok(scores.every((score) => score.components.length > 0));
  assert.ok(scores.some((score) => score.components.some((component) => component.evidenceKind === "unavailable")));
});

test("evidence items are classified with product-facing evidence labels", () => {
  assert.equal(classifyEvidenceItem(evidence[0]), "Verified public evidence");
  assert.equal(classifyEvidenceItem(evidence[1]), "Founder-provided evidence");
  assert.equal(classifyEvidenceItem({ ...evidence[1], sourceType: "customer interview" }), "Customer research");
  assert.equal(classifyEvidenceItem({ ...evidence[1], sourceType: "experiment result" }), "Experiment result");
  assert.equal(classifyEvidenceItem({ ...evidence[1], title: "Assumption: budget exists", sourceType: "founder assumption" }), "Assumption");
  assert.equal(classifyEvidenceItem({ ...evidence[1], verifiedStatus: "inferred", sourceType: "model assessment" }), "Generated assessment");
});

test("low-evidence scores expose insufficient-evidence states", () => {
  const sparseScores = calculateEvidenceScores({ ...input, knownCompetitors: "", mainAssumptions: "", websiteUrl: "" }, []);
  assert.ok(sparseScores.some((score) => score.conclusion.startsWith("Insufficient evidence.")));
  assert.ok(sparseScores.some((score) => getScoreEvidenceMetrics(score).insufficientEvidence));
});

test("score display metadata includes disclaimer and transparency fields", () => {
  const [score] = calculateEvidenceScores(input, evidence);
  const metrics = getScoreEvidenceMetrics(score);
  assert.match(EVIDENCE_SCORE_DISCLAIMER, /does not prove market demand or guarantee business success/);
  assert.ok(metrics.evidenceCount >= 1);
  assert.match(metrics.evidenceQuality, /^(Strong|Moderate|Low|Insufficient)$/);
  assert.ok(Array.isArray(metrics.missingEvidence));
  assert.match(metrics.confidenceLevel, /^(low|medium|high)$/);
  assert.ok(metrics.calculationSummary.includes("Calculated with"));
  assert.ok(metrics.improvementAction.length > 0);
});

test("overallValidationScore is bounded and confidence is explicit", () => {
  const overall = overallValidationScore(calculateEvidenceScores(input, evidence));
  assert.ok(overall.score >= 0 && overall.score <= 100);
  assert.match(overall.confidence, /^(low|medium|high)$/);
});

test("suggestExperiments turns weak categories into planned tests", () => {
  const experiments = suggestExperiments(input, calculateEvidenceScores(input, evidence));
  assert.equal(experiments.length, 3);
  assert.ok(experiments.every((experiment) => experiment.status === "planned"));
  assert.ok(experiments.every((experiment) => experiment.minimumSampleSize > 0));
});

test("normalizeHttpUrl rejects unsafe protocols", () => {
  assert.equal(normalizeHttpUrl("file:///etc/passwd"), null);
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("https://startupxai.in")?.hostname, "startupxai.in");
});

test("main visible surfaces avoid deprecated validation and AI-first terminology", () => {
  const root = join(process.cwd());
  const surfaces = [
    "src/app/(app)/evidence-engine/page.tsx",
    "src/components/app/EvidenceUI.tsx",
    "src/app/(app)/dashboard/page.tsx",
    "src/components/marketing/HeroSection.tsx",
    "src/components/marketing/Navbar.tsx",
  ];
  const banned = [
    "Validation Score",
    "AI Validation",
    "Validate your idea",
    "AI-generated insight",
    "Instant validation",
    "AI is thinking",
  ];

  for (const file of surfaces) {
    const source = readFileSync(join(root, file), "utf8");
    for (const phrase of banned) {
      assert.equal(source.includes(phrase), false, `${file} still contains "${phrase}"`);
    }
  }
});
