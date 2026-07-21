import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { EVIDENCE_SCORE_DISCLAIMER, classifyEvidenceItem, getScoreEvidenceMetrics } from "../src/lib/evidence-display";
import { calculateEvidenceScores, overallValidationScore, suggestExperiments } from "../src/lib/evidence-scoring";
import {
  evidenceWorkflowSchema,
  experimentSchema,
  interviewSchema,
  isGeneratedAssessmentVerified,
  normalizeWorkflowUrl,
  recalculateStoredEvidenceScore,
  verifiedStatusForEvidenceType,
  type StoredEvidenceForScore,
  type StoredExperimentForScore,
} from "../src/lib/evidence-workflow";
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

test("manual evidence CRUD payload validation accepts allowed classifications", () => {
  const parsed = evidenceWorkflowSchema.safeParse({
    title: "Support ticket pattern",
    claim: "Operations founders repeatedly ask for validation tracking",
    description: "Three support tickets mention the same workflow gap.",
    evidence_type: "founder_provided_evidence",
    evidence_direction: "supporting",
    source_url: "https://startupxai.in/research",
    source_name: "Founder notes",
    source_quality: "medium",
    confidence: "medium",
    collected_at: new Date().toISOString(),
    evidence_status: "active",
    linked_claims: ["Users need evidence workflows"],
  });
  assert.equal(parsed.success, true);
  assert.equal(evidenceWorkflowSchema.safeParse({ ...parsed.success && parsed.data, evidence_type: "ai_verified" }).success, false);
});

test("customer interview persistence payload is validated before storage", () => {
  const parsed = interviewSchema.safeParse({
    participant_segment: "Seed-stage SaaS founder",
    interview_date: "2026-07-21",
    problem_discussed: "Tracking assumptions after customer calls",
    pain_severity: 4,
    current_alternative: "Spreadsheet",
    key_quotes: "I lose the thread after each call.",
    objections: "Would need founder-friendly setup.",
    willingness_to_pay_signal: "Would pay if it saves weekly review time.",
    notes: "Follow-up requested.",
    follow_up_action: "Send prototype",
    convert_to_evidence: true,
  });
  assert.equal(parsed.success, true);
});

test("experiment lifecycle payload supports create, start, result, and close states", () => {
  for (const status of ["planned", "active", "completed", "closed"] as const) {
    const parsed = experimentSchema.safeParse({
      hypothesis: "Founders will add three evidence items before making a build decision",
      experiment_type: "Concierge onboarding",
      success_metric: "Evidence items per project",
      target_threshold: "3 evidence items in 7 days",
      status,
      measured_result: status === "planned" ? "" : "4 evidence items in 7 days",
      outcome: status === "completed" || status === "closed" ? "passed" : undefined,
    });
    assert.equal(parsed.success, true);
  }
});

test("migration defines RLS and ownership boundaries for persisted workflow tables", () => {
  const migration = readFileSync(join(process.cwd(), "migrations/010_persisted_evidence_workflow.sql"), "utf8");
  for (const table of ["customer_interviews", "evidence_claim_links"]) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
  }
  for (const policy of [
    "users_insert_own_evidence_items",
    "users_update_own_evidence_items",
    "users_delete_own_evidence_items",
    "users_insert_own_customer_interviews",
    "users_insert_own_evidence_claim_links",
    "users_insert_own_project_activity",
  ]) {
    assert.ok(migration.includes(policy), `${policy} missing`);
  }
  assert.match(migration, /validation_projects\.user_id = auth\.uid\(\)::text/);
});

test("generated assessments are never classified as verified evidence", () => {
  assert.equal(verifiedStatusForEvidenceType("generated_assessment"), "inferred");
  assert.equal(isGeneratedAssessmentVerified("generated_assessment", "verified"), true);
  assert.equal(isGeneratedAssessmentVerified("customer_research", "verified"), false);
});

test("stored score recalculation shows insufficient evidence below thresholds", () => {
  const score = recalculateStoredEvidenceScore({
    category: "customer_urgency",
    label: "Customer urgency",
    evidence: [],
    experiments: [],
  });
  assert.equal(score.confidence, "low");
  assert.ok(score.score <= 44);
  assert.match(score.conclusion, /^Insufficient evidence\./);
  assert.ok(score.components.some((component) => component.rawSignal.minimumRequired === 3));
});

test("stored score recalculation uses quality, freshness, links, and completed experiments", () => {
  const now = new Date().toISOString();
  const evidenceRows: StoredEvidenceForScore[] = [
    {
      id: "ev_support_1",
      title: "Interview proof",
      claim: "Pain is urgent",
      summary: "Customer said the manual workaround wastes hours.",
      evidence_category: "customer_urgency",
      evidence_direction: "supports",
      evidence_type: "customer_research",
      source_quality: "high",
      confidence: "high",
      reliability_score: 90,
      created_at: now,
    },
    {
      id: "ev_support_2",
      title: "Public forum thread",
      claim: "Existing alternatives are painful",
      summary: "Several founders discuss the same reporting problem.",
      evidence_category: "customer_urgency",
      evidence_direction: "supports",
      evidence_type: "verified_public_evidence",
      source_quality: "medium",
      confidence: "medium",
      reliability_score: 70,
      created_at: now,
    },
    {
      id: "ev_assumption",
      title: "Assumption: willingness to pay",
      claim: "Founders will pay",
      summary: "Pricing sensitivity still needs proof.",
      evidence_category: "evidence_strength",
      evidence_direction: "neutral",
      evidence_type: "assumption",
      source_quality: "low",
      confidence: "low",
      reliability_score: 35,
      created_at: now,
    },
  ];
  const experiments: StoredExperimentForScore[] = [
    { id: "exp_1", hypothesis: "Founders add sources during onboarding", status: "completed", outcome: "passed", learning: "4 of 5 founders added sources.", updated_at: now },
  ];
  const score = recalculateStoredEvidenceScore({ category: "customer_urgency", label: "Customer urgency", evidence: evidenceRows, experiments });
  assert.ok(score.score > 44);
  assert.match(score.methodology, /source quality, freshness, confidence, direction/);
  assert.ok(score.components.some((component) => Array.isArray(component.rawSignal.linkedEvidenceIds)));
  assert.ok(score.components.some((component) => Array.isArray(component.rawSignal.linkedExperimentIds)));
});

test("contradicting evidence lowers stored evidence scores", () => {
  const now = new Date().toISOString();
  const baseEvidence: StoredEvidenceForScore = {
    id: "ev_support",
    title: "Interview proof",
    claim: "Pain is urgent",
    summary: "Customer described weekly pain.",
    evidence_category: "problem_clarity",
    evidence_direction: "supports",
    evidence_type: "customer_research",
    source_quality: "high",
    confidence: "high",
    reliability_score: 90,
    created_at: now,
  };
  const supportingOnly = recalculateStoredEvidenceScore({
    category: "problem_clarity",
    label: "Problem clarity",
    evidence: [baseEvidence, { ...baseEvidence, id: "ev_2" }, { ...baseEvidence, id: "ev_3" }],
    experiments: [],
  });
  const withContradiction = recalculateStoredEvidenceScore({
    category: "problem_clarity",
    label: "Problem clarity",
    evidence: [
      baseEvidence,
      { ...baseEvidence, id: "ev_2" },
      { ...baseEvidence, id: "ev_contra", evidence_direction: "contradicts", summary: "Prospect said this is not a priority." },
    ],
    experiments: [],
  });
  assert.ok(withContradiction.score < supportingOnly.score);
  assert.ok(withContradiction.opposingEvidence.length > 0);
});

test("activity history events are recorded by workflow routes", () => {
  const files = [
    "src/app/api/evidence-projects/[projectId]/evidence/route.ts",
    "src/app/api/evidence-projects/[projectId]/evidence/[evidenceId]/route.ts",
    "src/app/api/evidence-projects/[projectId]/interviews/route.ts",
    "src/app/api/evidence-projects/[projectId]/experiments/[experimentId]/route.ts",
    "src/lib/evidence-workflow-store.ts",
  ].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
  for (const event of ["evidence_added", "evidence_edited", "evidence_deleted", "interview_recorded", "experiment_started", "experiment_completed", "score_changed"]) {
    assert.ok(files.includes(event), `${event} missing`);
  }
});

test("workflow URL normalization rejects invalid and unsafe URLs", () => {
  assert.equal(normalizeWorkflowUrl("javascript:alert(1)"), null);
  assert.equal(normalizeWorkflowUrl("file:///windows/win.ini"), null);
  assert.equal(normalizeWorkflowUrl("ftp://startupxai.in/source"), null);
  assert.equal(normalizeWorkflowUrl("https://startupxai.in/path#secret")?.includes("#secret"), false);
});
