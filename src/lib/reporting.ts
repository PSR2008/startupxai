import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabase";
import { ENGINE_LABELS } from "./plans";
import { trackProductEvent } from "./analytics";

export type ReportOutputType = "detailed" | "investor_memo" | "slide_summary";
export type ShareExpiryOption = "none" | "7d" | "30d";
export type ShareReportKind = "analysis" | "generated_report";

export interface StoredAnalysis {
  id: string;
  user_id: string | null;
  engine_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  created_at: string;
}

export interface FounderProfileSnapshot {
  startup_idea?: string | null;
  product_summary?: string | null;
  target_audience?: string | null;
  industry?: string | null;
  founder_stage?: string | null;
  region?: string | null;
  primary_goal?: string | null;
}

export interface GeneratedReport {
  id: string;
  user_id: string;
  source_analysis_id: string | null;
  report_type: ReportOutputType;
  title: string;
  content: FounderReportContent;
  created_at: string;
  updated_at: string;
}

export interface FounderReportSection {
  title: string;
  body?: string;
  items?: string[];
}

export interface FounderReportContent {
  reportType: ReportOutputType;
  title: string;
  subtitle: string;
  generatedAt: string;
  sourceAnalysisId: string;
  startup: {
    name: string;
    summary: string;
    targetAudience: string;
    industry?: string | null;
    region?: string | null;
  };
  sections: FounderReportSection[];
  nextActions: string[];
  disclaimer: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatStructuredValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const name = asString(record.name) || asString(record.model) || asString(record.priority) || asString(record.channel);
  const description =
    asString(record.description) ||
    asString(record.rationale) ||
    asString(record.targetSegment) ||
    asString(record.action) ||
    asString(record.why);

  if (name && description) return `${name}: ${description}`;
  if (name) return name;
  if (description) return description;

  const scalarPairs = Object.entries(record)
    .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
    .slice(0, 4)
    .map(([key, item]) => `${key}: ${String(item)}`);

  return scalarPairs.join("; ");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => formatStructuredValue(item)).filter(Boolean)
    : [];
}

function titleFromAnalysis(analysis: StoredAnalysis, profile: FounderProfileSnapshot | null): string {
  const input = analysis.input_data ?? {};
  return (
    asString(input.idea) ||
    asString(input.product) ||
    asString(profile?.startup_idea) ||
    "Startup concept"
  );
}

function section(title: string, body?: unknown, items?: unknown): FounderReportSection | null {
  const cleanBody = asString(body);
  const cleanItems = asStringArray(items);
  if (!cleanBody && cleanItems.length === 0) return null;
  return {
    title,
    ...(cleanBody ? { body: cleanBody } : {}),
    ...(cleanItems.length ? { items: cleanItems } : {}),
  };
}

function compact<T>(items: Array<T | null | undefined>): T[] {
  return items.filter(Boolean) as T[];
}

function buildEvidenceReportSections(output: Record<string, unknown>): FounderReportSection[] {
  return compact([
    section("Assessment Confidence", output.confidenceExplanation ?? output.confidenceReasons ?? output.confidence),
    section("Score Calculation Details", undefined, output.componentCalculations ?? output.scoreComponents ?? output.scores),
    section("Evidence Provenance", undefined, output.evidenceProvenance ?? output.evidenceItems ?? output.sources),
    section("Missing Evidence And Contradictions", undefined, output.missingEvidence ?? output.validationGaps ?? output.limitations),
    section("Recommended Next Validation Tests", undefined, output.recommendedTests ?? output.suggestedExperiments ?? output.nextValidationActions),
  ]);
}

function buildSections(analysis: StoredAnalysis, type: ReportOutputType): FounderReportSection[] {
  const output = analysis.output_data ?? {};
  const engine = analysis.engine_type;
  const evidenceSections = buildEvidenceReportSections(output);

  if (type === "investor_memo") {
    return compact([
      section("Problem", output.executiveSummary ?? output.brutalRoast ?? output.comparisonSummary),
      section("Proposed Solution", output.categoryPositioning ?? output.strategicAdvantage ?? output.revenueVerdict),
      section("Target Customer", undefined, output.idealICP ?? output.audienceSegments),
      section("Market Opportunity", undefined, output.hiddenOpportunities ?? output.whiteSpaceOpportunities),
      section("Competitor Landscape", output.comparisonSummary, output.positioningGaps),
      section("Business / Revenue Model", output.revenueVerdict, output.pricingSuggestions),
      section("Go-To-Market Direction", undefined, output.customerAcquisitionPriorities ?? output.launchSteps),
      section("Important Risks", undefined, output.riskFactors ?? output.whyItMayFail ?? output.conversionBlockers),
      ...evidenceSections,
      section("Immediate Next Step", output.whatToFixFirst, output.actionableNextSteps),
    ]);
  }

  if (type === "slide_summary") {
    return compact([
      section("1. Title", `${ENGINE_LABELS[engine as keyof typeof ENGINE_LABELS] ?? "StartupX AI"} founder summary`),
      section("2. Problem", output.executiveSummary ?? output.brutalRoast),
      section("3. Solution", output.categoryPositioning ?? output.strategicAdvantage),
      section("4. Market", undefined, output.hiddenOpportunities ?? output.audienceSegments),
      section("5. Customer", undefined, output.idealICP),
      section("6. Competitors", output.comparisonSummary, output.directCompetitors),
      section("7. Differentiation", undefined, output.differentiationSuggestions ?? output.positioningGaps),
      section("8. Business Model", output.revenueVerdict, output.monetizationModels),
      section("9. Pricing", undefined, output.pricingSuggestions ?? output.psychologicalPricingTips),
      section("10. Go-To-Market", output.outreachDirection, output.launchSteps ?? output.customerAcquisitionPriorities),
      section("11. Risks", undefined, output.riskFactors ?? output.whyItMayFail ?? output.revenueLeaks),
      ...evidenceSections,
      section("12. Next Steps", output.whatToFixFirst, output.actionableNextSteps ?? output.launchSteps),
    ]);
  }

  return compact([
    section("Executive Summary", output.executiveSummary ?? output.overallVerdict ?? output.comparisonSummary ?? output.revenueVerdict),
    section("Concept Summary", output.categoryPositioning ?? output.strategicAdvantage),
    section("Market Analysis", undefined, output.hiddenOpportunities ?? output.audienceSegments),
    section("Market Risks", undefined, output.riskFactors ?? output.whyItMayFail),
    section("Assumptions To Validate", undefined, output.assumptionsDetected),
    section("Competitor Mapping", output.comparisonSummary, output.directCompetitors),
    section("Competitive Advantages", output.strategicAdvantage, output.howToBeatThem),
    section("Differentiation Gaps", undefined, output.differentiationSuggestions ?? output.positioningGaps),
    section("Pricing Recommendations", output.revenueVerdict, output.pricingSuggestions),
    section("Revenue Model Analysis", undefined, output.monetizationModels),
    section("User Psychology Insights", output.brutalRoast, output.uxRecommendations),
    section("Growth Recommendations", undefined, output.launchSteps ?? output.customerAcquisitionPriorities),
    section("Founder Decisions", output.finalVerdict, output.actionableNextSteps ?? output.top3Priorities),
    ...evidenceSections,
    section("Brand Recommendations", output.brandPackSummary, output.positioningLines ?? output.taglines),
    section("Cold Outreach Recommendations", undefined, output.followUpVariants ?? output.ctaVariations),
  ]);
}

function nextActionsFromSections(sections: FounderReportSection[]): string[] {
  const candidates = sections.flatMap((item) => item.items ?? []);
  return candidates.slice(0, 7);
}

export function buildFounderReportContent(
  analysis: StoredAnalysis,
  profile: FounderProfileSnapshot | null,
  reportType: ReportOutputType
): FounderReportContent {
  const input = analysis.input_data ?? {};
  const startupName = titleFromAnalysis(analysis, profile);
  const sections = buildSections(analysis, reportType);
  const nextActions = nextActionsFromSections(sections);
  const reportLabel =
    reportType === "investor_memo"
      ? "One-Page Investor Memo"
      : reportType === "slide_summary"
      ? "Slide-Ready Founder Summary"
      : "Detailed Validation Report";

  return {
    reportType,
    title: `${startupName} - ${reportLabel}`,
    subtitle: ENGINE_LABELS[analysis.engine_type as keyof typeof ENGINE_LABELS] ?? "StartupX AI Report",
    generatedAt: new Date().toISOString(),
    sourceAnalysisId: analysis.id,
    startup: {
      name: startupName,
      summary: asString(input.description) || asString(input.product) || asString(profile?.product_summary),
      targetAudience: asString(input.targetAudience) || asString(profile?.target_audience),
      industry: asString(input.industry) || profile?.industry || null,
      region: asString(input.region) || profile?.region || null,
    },
    sections,
    nextActions,
    disclaimer:
      "StartupX AI provides decision-support analysis based on user inputs, generated reasoning, and any evidence available in the workflow. It is not business, financial, legal, or investment advice. Assess assumptions with real customers and current market data.",
  };
}

export async function getAnalysisForOwner(userId: string, analysisId: string): Promise<StoredAnalysis | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("analyses")
    .select("id, user_id, engine_type, input_data, output_data, created_at")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getAnalysisForOwner] failed:", error.message);
    return null;
  }

  return (data as StoredAnalysis | null) ?? null;
}

export async function getFounderProfileSnapshot(userId: string): Promise<FounderProfileSnapshot | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("founder_profiles")
    .select("startup_idea, product_summary, target_audience, industry, founder_stage, region, primary_goal")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getFounderProfileSnapshot] failed:", error.message);
    return null;
  }

  return (data as FounderProfileSnapshot | null) ?? null;
}

export async function createGeneratedReport(params: {
  userId: string;
  analysisId: string;
  reportType: ReportOutputType;
}): Promise<GeneratedReport | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const analysis = await getAnalysisForOwner(params.userId, params.analysisId);
  if (!analysis) return null;

  const profile = await getFounderProfileSnapshot(params.userId);
  const content = buildFounderReportContent(analysis, profile, params.reportType);

  const { data, error } = await admin
    .from("generated_reports")
    .insert({
      user_id: params.userId,
      source_analysis_id: params.analysisId,
      report_type: params.reportType,
      title: content.title,
      content,
    })
    .select("id, user_id, source_analysis_id, report_type, title, content, created_at, updated_at")
    .single();

  if (error) {
    console.error("[createGeneratedReport] failed:", error.message);
    return null;
  }

  return data as GeneratedReport;
}

export async function getGeneratedReportForOwner(
  userId: string,
  reportId: string
): Promise<GeneratedReport | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("generated_reports")
    .select("id, user_id, source_analysis_id, report_type, title, content, created_at, updated_at")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getGeneratedReportForOwner] failed:", error.message);
    return null;
  }

  return (data as GeneratedReport | null) ?? null;
}

function hashShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function expiryDate(option: ShareExpiryOption): string | null {
  const now = new Date();
  if (option === "7d") {
    now.setDate(now.getDate() + 7);
    return now.toISOString();
  }
  if (option === "30d") {
    now.setDate(now.getDate() + 30);
    return now.toISOString();
  }
  return null;
}

export async function createShareLink(params: {
  ownerUserId: string;
  reportKind: ShareReportKind;
  reportId: string;
  expiresIn: ShareExpiryOption;
}): Promise<{ token: string; expiresAt: string | null } | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = expiryDate(params.expiresIn);

  const { error } = await admin.from("shared_report_links").insert({
    owner_user_id: params.ownerUserId,
    report_kind: params.reportKind,
    report_id: params.reportId,
    token_hash: hashShareToken(token),
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[createShareLink] failed:", error.message);
    return null;
  }

  await trackProductEvent("share_link_created", {
    userId: params.ownerUserId,
    properties: {
      report_kind: params.reportKind,
      expires_in: params.expiresIn,
    },
  });

  return { token, expiresAt };
}

export async function revokeShareLinks(params: {
  ownerUserId: string;
  reportKind: ShareReportKind;
  reportId: string;
}): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const { error } = await admin
    .from("shared_report_links")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("owner_user_id", params.ownerUserId)
    .eq("report_kind", params.reportKind)
    .eq("report_id", params.reportId)
    .eq("is_active", true);

  if (error) {
    console.error("[revokeShareLinks] failed:", error.message);
    return false;
  }

  await trackProductEvent("share_link_revoked", {
    userId: params.ownerUserId,
    properties: { report_kind: params.reportKind },
  });

  return true;
}

export async function getSharedReportByToken(token: string): Promise<{
  reportKind: ShareReportKind;
  report: StoredAnalysis | GeneratedReport;
} | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const tokenHash = hashShareToken(token);
  const { data: link, error } = await admin
    .from("shared_report_links")
    .select("id, report_kind, report_id, owner_user_id, is_active, expires_at, view_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !link || !link.is_active) return null;

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return null;
  }

  await admin
    .from("shared_report_links")
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: Number(link.view_count ?? 0) + 1,
    })
    .eq("id", link.id);

  await trackProductEvent("share_link_opened", {
    userId: link.owner_user_id,
    properties: { report_kind: link.report_kind },
  });

  if (link.report_kind === "generated_report") {
    const { data: report } = await admin
      .from("generated_reports")
      .select("id, user_id, source_analysis_id, report_type, title, content, created_at, updated_at")
      .eq("id", link.report_id)
      .eq("user_id", link.owner_user_id)
      .maybeSingle();
    return report ? { reportKind: "generated_report", report: report as GeneratedReport } : null;
  }

  const { data: analysis } = await admin
    .from("analyses")
    .select("id, user_id, engine_type, input_data, output_data, created_at")
    .eq("id", link.report_id)
    .eq("user_id", link.owner_user_id)
    .maybeSingle();

  return analysis ? { reportKind: "analysis", report: analysis as StoredAnalysis } : null;
}
