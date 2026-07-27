import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  IdeaEngineOutput,
  CompetitorEngineOutput,
  RevenueEngineOutput,
  PsychologyEngineOutput,
  GrowthEngineOutput,
  DecisionEngineOutput,
  ColdDMOutput,
  BrandForgeOutput,
} from "@/types";

// ============================================
// AI CLIENT — Anthropic Claude Integration
// All analysis powered by Claude claude-sonnet-4-20250514
// ============================================

// IMPORTANT: API key is NEVER exposed client-side
// Only used in server-side API routes
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
export const COMPETITOR_PROVIDER_TIMEOUT_MS = 45_000;
export const COMPETITOR_MAX_TOKENS = 1800;
export const COMPETITOR_MAX_RETRIES = 0;
const COMPETITOR_INPUT_LIMITS = {
  idea: 420,
  competitorNames: 350,
  industry: 160,
  startupUrl: 240,
};

export class AIProviderResponseError extends Error {
  code: "INVALID_PROVIDER_RESPONSE";
  retryable: boolean;

  constructor(message = "The analysis provider returned an invalid response.") {
    super(message);
    this.name = "AIProviderResponseError";
    this.code = "INVALID_PROVIDER_RESPONSE";
    this.retryable = true;
  }
}

export class AIProviderTimeoutError extends Error {
  code: "PROVIDER_TIMEOUT";
  retryable: boolean;

  constructor(message = "The analysis provider took too long to respond.") {
    super(message);
    this.name = "AIProviderTimeoutError";
    this.code = "PROVIDER_TIMEOUT";
    this.retryable = true;
  }
}

export interface ProviderTimingSink {
  (phase: "prompt" | "provider" | "parse" | "schema", elapsedMs: number): void;
}

function boundInput(value: string | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

const BASE_SYSTEM_PROMPT = `
You are a world-class startup analyst (ex-McKinsey, YC partner level).

Your job is to brutally evaluate startup ideas like an investor.

RULES:
- Be extremely specific and non-generic
- Think commercially (revenue, differentiation, defensibility)
- Avoid motivational tone — be sharp and realistic
- Assume competition from AI tools like ChatGPT, Claude, etc.
- Focus on WHY this fails or succeeds in real market conditions

OUTPUT REQUIREMENTS:

1. marketDemandScore (0–100)
2. ideaClarityScore (0–100)

3. executiveSummary:
- 4–5 sentences max
- Clear strengths + core weakness

4. overallVerdict:
- One bold, strong statement like an investor decision

5. categoryPositioning:
- Reframe idea into strongest possible positioning

6. riskFactors (5 points):
- Real business risks (not generic)

7. hiddenOpportunities (5 points):
- High-leverage insights

8. assumptionsDetected (4–5 points):
- What founder is assuming

9. whyItMayFail (4–5 points):
- Brutal failure reasons

10. differentiationSuggestions (4–5 points):
- Real strategic moves

11. idealICP (4–5 points):
- High-paying customer segments only

Be sharp. Be investor-level. No fluff.
`;

// --- Safe JSON extractor from AI response ---
function extractJson<T>(text: string, fallback: T): T {
  // Try to extract JSON block from markdown code blocks first
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]) as T;
    } catch {
      // continue
    }
  }

  // Try raw JSON extraction
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // continue
    }
  }

  return fallback;
}

function extractRequiredJson(text: string): unknown {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [jsonBlockMatch?.[1], text.match(/\{[\s\S]*\}/)?.[0]].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new AIProviderResponseError();
}

const competitorSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).default([]),
  weaknesses: z.array(z.string().trim().min(1)).default([]),
  url: z.string().trim().optional(),
});

export const competitorOutputSchema = z.object({
  directCompetitors: z.array(competitorSchema),
  indirectCompetitors: z.array(competitorSchema),
  positioningGaps: z.array(z.string().trim().min(1)),
  howToBeatThem: z.array(z.string().trim().min(1)),
  whiteSpaceOpportunities: z.array(z.string().trim().min(1)),
  comparisonSummary: z.string().trim().min(1),
  strategicAdvantage: z.string().trim().min(1),
});

export function parseCompetitorOutput(text: string): CompetitorEngineOutput {
  const parsed = competitorOutputSchema.safeParse(extractRequiredJson(text));
  if (!parsed.success) {
    throw new AIProviderResponseError("The analysis provider returned incomplete competitor analysis.");
  }
  return parsed.data;
}

function normalizeProviderError(error: unknown): never {
  if (error instanceof Error && error.name === "AbortError") {
    throw new AIProviderTimeoutError();
  }
  if (error && typeof error === "object") {
    const record = error as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof record.code === "string" ? record.code.toLowerCase() : "";
    const name = typeof record.name === "string" ? record.name.toLowerCase() : "";
    const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
    if (code.includes("timeout") || name.includes("timeout") || message.includes("timed out") || message.includes("timeout")) {
      throw new AIProviderTimeoutError();
    }
  }
  throw error;
}

// ============================================
// IDEA & MARKET ENGINE
// ============================================
export async function analyzeIdea(input: {
  idea: string;
  description: string;
  targetAudience: string;
  industry?: string;
  region?: string;
  productUrl?: string;
}): Promise<IdeaEngineOutput> {
  const client = getClient();

  const prompt = `You are a world-class startup analyst and venture strategist with 20+ years of experience evaluating startup ideas for top-tier VCs and founders.

Analyze this startup idea with brutal honesty, strategic depth, and commercial precision:

STARTUP IDEA: ${input.idea}
DESCRIPTION: ${input.description}
TARGET AUDIENCE: ${input.targetAudience}
${input.industry ? `INDUSTRY: ${input.industry}` : ""}
${input.region ? `REGION/MARKET: ${input.region}` : ""}
${input.productUrl ? `PRODUCT URL: ${input.productUrl}` : ""}

Respond ONLY with a valid JSON object in this exact structure. No markdown, no preamble:

{
  "marketDemandScore": <integer 0-100>,
  "ideaClarityScore": <integer 0-100>,
  "riskFactors": [<3-5 specific, concrete risk factors>],
  "assumptionsDetected": [<3-5 hidden assumptions the founder is making>],
  "whyItMayFail": [<3-5 honest, non-generic failure modes>],
  "hiddenOpportunities": [<3-5 opportunities the founder may not have spotted>],
  "differentiationSuggestions": [<3-5 sharp differentiation angles>],
  "idealICP": [<3-5 very specific ICP profiles, not generic>],
  "categoryPositioning": "<one sharp sentence on how to position this>",
  "overallVerdict": "<honest 2-3 sentence executive verdict>",
  "executiveSummary": "<4-5 sentence founder-grade summary with actionable tone>"
}

Be specific, sharp, commercially-aware. Avoid generic advice. Score honestly.`;

  const response = await client.messages.create({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  system: BASE_SYSTEM_PROMPT,
  messages: [{ role: "user", content: prompt }],
});

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<IdeaEngineOutput>(text, {
    marketDemandScore: 50,
    ideaClarityScore: 50,
    riskFactors: ["Unable to process analysis. Please try again."],
    assumptionsDetected: [],
    whyItMayFail: [],
    hiddenOpportunities: [],
    differentiationSuggestions: [],
    idealICP: [],
    categoryPositioning: "Analysis failed",
    overallVerdict: "Analysis failed. Please try again.",
    executiveSummary: "Analysis failed. Please check your input and try again.",
  });
}

// ============================================
// COMPETITOR INTELLIGENCE ENGINE
// ============================================
export async function analyzeCompetitors(input: {
  idea: string;
  competitorNames?: string;
  industry?: string;
  startupUrl?: string;
}, timing?: ProviderTimingSink): Promise<CompetitorEngineOutput> {
  const client = getClient();
  const promptStartedAt = Date.now();
  const bounded = {
    idea: boundInput(input.idea, COMPETITOR_INPUT_LIMITS.idea),
    competitorNames: boundInput(input.competitorNames, COMPETITOR_INPUT_LIMITS.competitorNames),
    industry: boundInput(input.industry, COMPETITOR_INPUT_LIMITS.industry),
    startupUrl: boundInput(input.startupUrl, COMPETITOR_INPUT_LIMITS.startupUrl),
  };

  const prompt = `Assess competitor positioning for this startup using only the supplied context and general model knowledge. Do not claim live research or verified market facts.

Startup idea: ${bounded.idea}
${bounded.competitorNames ? `Known competitors: ${bounded.competitorNames}` : ""}
${bounded.industry ? `Industry: ${bounded.industry}` : ""}
${bounded.startupUrl ? `Product URL: ${bounded.startupUrl}` : ""}

Return only valid JSON matching this schema:

{
  "directCompetitors": [
    {
      "name": "<name>",
      "description": "<one concise sentence>",
      "strengths": ["<strength>", "<strength>"],
      "weaknesses": ["<weakness>", "<weakness>"],
      "url": "<known website or empty string>"
    }
  ],
  "indirectCompetitors": [
    {
      "name": "<name>",
      "description": "<one concise sentence>",
      "strengths": ["<strength>", "<strength>"],
      "weaknesses": ["<weakness>", "<weakness>"],
      "url": "<known website or empty string>"
    }
  ],
  "positioningGaps": ["<gap>", "<gap>", "<gap>"],
  "howToBeatThem": ["<strategy>", "<strategy>", "<strategy>", "<strategy>"],
  "whiteSpaceOpportunities": ["<opportunity>", "<opportunity>", "<opportunity>"],
  "comparisonSummary": "<2 concise sentences>",
  "strategicAdvantage": "<2 concise sentences>"
}

Use relevant known competitor names when supplied. Keep arrays compact and specific.`;
  timing?.("prompt", Date.now() - promptStartedAt);

  const providerStartedAt = Date.now();
  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: COMPETITOR_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      },
      {
        timeout: COMPETITOR_PROVIDER_TIMEOUT_MS,
        maxRetries: COMPETITOR_MAX_RETRIES,
      }
    );
  } catch (error) {
    timing?.("provider", Date.now() - providerStartedAt);
    normalizeProviderError(error);
  }
  timing?.("provider", Date.now() - providerStartedAt);

  const parseStartedAt = Date.now();
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  timing?.("parse", Date.now() - parseStartedAt);

  const schemaStartedAt = Date.now();
  const parsed = parseCompetitorOutput(text);
  timing?.("schema", Date.now() - schemaStartedAt);
  return parsed;
}

// ============================================
// REVENUE ENGINE
// ============================================
export async function analyzeRevenue(input: {
  idea: string;
  description: string;
  targetAudience: string;
  currentPricing?: string;
  businessModel?: string;
  productType?: string;
  geography?: string;
  expectedCustomerWillingnessToPay?: string;
  estimatedCac?: string;
  grossMarginPercent?: string;
  competitorPricing?: string;
  freeTierAvailability?: string;
  expectedFreeToPaidConversion?: string;
  usagePattern?: string;
  customerFrequency?: string;
  costAssumptions?: string;
  targetMonthlyRevenue?: string;
  customerVolumeAssumption?: string;
  variableCostPerCustomer?: string;
}): Promise<RevenueEngineOutput> {
  const client = getClient();

  const prompt = `You are an elite SaaS pricing strategist and revenue consultant who has helped hundreds of startups optimize their monetization.

Analyze revenue and pricing for this startup:

STARTUP IDEA: ${input.idea}
DESCRIPTION: ${input.description}
TARGET AUDIENCE: ${input.targetAudience}
${input.currentPricing ? `CURRENT PRICING: ${input.currentPricing}` : ""}
${input.businessModel ? `BUSINESS MODEL: ${input.businessModel}` : ""}
${input.productType ? `PRODUCT TYPE: ${input.productType}` : ""}
${input.geography ? `GEOGRAPHY: ${input.geography}` : ""}
${input.expectedCustomerWillingnessToPay ? `EXPECTED WILLINGNESS TO PAY: ${input.expectedCustomerWillingnessToPay}` : ""}
${input.estimatedCac ? `ESTIMATED CAC: ${input.estimatedCac}` : ""}
${input.grossMarginPercent ? `GROSS MARGIN PERCENT: ${input.grossMarginPercent}` : ""}
${input.competitorPricing ? `COMPETITOR PRICING: ${input.competitorPricing}` : ""}
${input.freeTierAvailability ? `FREE TIER AVAILABILITY: ${input.freeTierAvailability}` : ""}
${input.expectedFreeToPaidConversion ? `EXPECTED FREE-TO-PAID CONVERSION: ${input.expectedFreeToPaidConversion}` : ""}
${input.usagePattern ? `USAGE PATTERN: ${input.usagePattern}` : ""}
${input.customerFrequency ? `CUSTOMER FREQUENCY: ${input.customerFrequency}` : ""}
${input.costAssumptions ? `COST ASSUMPTIONS: ${input.costAssumptions}` : ""}
${input.targetMonthlyRevenue ? `TARGET MONTHLY REVENUE: ${input.targetMonthlyRevenue}` : ""}
${input.customerVolumeAssumption ? `CUSTOMER VOLUME ASSUMPTION: ${input.customerVolumeAssumption}` : ""}
${input.variableCostPerCustomer ? `VARIABLE COST PER CUSTOMER: ${input.variableCostPerCustomer}` : ""}

Use the numeric context above when present, but do not invent exact calculations. Deterministic calculations are added separately by the app.

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  "pricingSuggestions": [
    {
      "name": "<tier name>",
      "price": "<price string e.g. $29/mo>",
      "billingCycle": "<monthly|annually|one-time|usage>",
      "features": [<4-6 specific features>],
      "recommended": <true|false>,
      "targetSegment": "<who this tier targets>"
    }
  ],
  "monetizationModels": [
    {
      "model": "<model name>",
      "description": "<2 sentence description>",
      "pros": [<2-3 pros>],
      "cons": [<2-3 cons>],
      "fitScore": <integer 0-100>
    }
  ],
  "psychologicalPricingTips": [<4-6 specific psychological pricing tactics>],
  "revenueLeaks": [<3-5 specific revenue leaks to fix>],
  "conversionBlockers": [<4-6 reasons users won't convert>],
  "upsellOpportunities": [<3-5 specific upsell/cross-sell opportunities>],
  "revenueVerdict": "<3-4 sentence honest revenue strategy verdict>"
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<RevenueEngineOutput>(text, {
    pricingSuggestions: [],
    monetizationModels: [],
    psychologicalPricingTips: [],
    revenueLeaks: [],
    conversionBlockers: [],
    upsellOpportunities: [],
    revenueVerdict: "Analysis failed. Please try again.",
  });
}

// ============================================
// USER PSYCHOLOGY ENGINE
// ============================================
export async function analyzePsychology(input: {
  idea: string;
  description: string;
  targetAudience: string;
  productUrl?: string;
  currentCopy?: string;
}): Promise<PsychologyEngineOutput> {
  const client = getClient();

  const prompt = `You are a world-class UX psychologist, conversion expert, and brand strategist who has worked with top consumer and B2B products.

Brutally analyze the user psychology and trust factors for this startup:

STARTUP IDEA: ${input.idea}
DESCRIPTION: ${input.description}
TARGET AUDIENCE: ${input.targetAudience}
${input.productUrl ? `PRODUCT URL: ${input.productUrl}` : ""}
${input.currentCopy ? `CURRENT COPY/MESSAGING: ${input.currentCopy}` : ""}

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  "trustScore": <integer 0-100>,
  "brutalRoast": "<2-3 sentences of honest, specific roast about current perception issues>",
  "credibilityGaps": [<3-5 specific credibility gaps>],
  "frictionPoints": [<4-6 specific friction points in the user journey>],
  "firstImpressionIssues": [<3-5 specific first impression problems>],
  "confusingCopyIssues": [<3-5 specific copy/messaging clarity issues>],
  "emotionalObjections": [<4-6 emotional objections users will have>],
  "uxRecommendations": [<5-7 specific, actionable UX improvements>],
  "trustBuildingActions": [<4-6 specific actions to build trust fast>]
}

Be specific, psychological, and founder-grade. Not generic. Reference actual product characteristics.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<PsychologyEngineOutput>(text, {
    trustScore: 50,
    brutalRoast: "Analysis failed. Please try again.",
    credibilityGaps: [],
    frictionPoints: [],
    firstImpressionIssues: [],
    confusingCopyIssues: [],
    emotionalObjections: [],
    uxRecommendations: [],
    trustBuildingActions: [],
  });
}

// ============================================
// GROWTH ENGINE
// ============================================
export async function analyzeGrowth(input: {
  idea: string;
  description: string;
  targetAudience: string;
  currentChannels?: string;
  budget?: string;
  stage?: string;
}): Promise<GrowthEngineOutput> {
  const client = getClient();

  const prompt = `You are a disciplined growth strategist who designs lean, measurable first-customer experiments.

Create a precise growth strategy for this startup:

STARTUP IDEA: ${input.idea}
DESCRIPTION: ${input.description}
TARGET AUDIENCE: ${input.targetAudience}
${input.currentChannels ? `CURRENT CHANNELS: ${input.currentChannels}` : ""}
${input.budget ? `BUDGET: ${input.budget}` : ""}
${input.stage ? `STAGE: ${input.stage}` : ""}

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  "first10CustomersPlan": [
    {
      "step": <1-7>,
      "action": "<specific action>",
      "timeline": "<e.g. Day 1-3>",
      "expectedOutcome": "<specific expected outcome>"
    }
  ],
  "channelSuggestions": [
    {
      "channel": "<channel name>",
      "effort": "<low|medium|high>",
      "impact": "<low|medium|high>",
      "description": "<2 sentence description>",
      "tactics": [<2-4 specific tactics>]
    }
  ],
  "audienceSegments": [<4-6 specific audience segments with why>],
  "contentHooks": [<5-8 specific content angles that will work>],
  "campaignSuggestions": [<3-5 specific campaign ideas>],
  "launchSteps": [<6-10 ordered launch steps>],
  "outreachDirection": {
    "whatsapp": "<specific WhatsApp outreach angle>",
    "linkedin": "<specific LinkedIn outreach angle>",
    "email": "<specific email outreach angle>"
  },
  "customerAcquisitionPriorities": [<4-6 prioritized CAC strategies>]
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<GrowthEngineOutput>(text, {
    first10CustomersPlan: [],
    channelSuggestions: [],
    audienceSegments: [],
    contentHooks: [],
    campaignSuggestions: [],
    launchSteps: [],
    outreachDirection: { whatsapp: "", linkedin: "", email: "" },
    customerAcquisitionPriorities: [],
  });
}

// ============================================
// FOUNDER DECISION ENGINE
// ============================================
export async function analyzeDecision(input: {
  idea: string;
  description: string;
  targetAudience: string;
  currentStatus?: string;
  biggestChallenge?: string;
  resources?: string;
}): Promise<DecisionEngineOutput> {
  const client = getClient();

  const prompt = `You are a world-class startup mentor, board advisor, and former founder who has built and sold multiple companies. You give the kind of advice that would come from a seasoned co-founder, not a consultant.

Give executive-level strategic guidance for this founder:

STARTUP IDEA: ${input.idea}
DESCRIPTION: ${input.description}
TARGET AUDIENCE: ${input.targetAudience}
${input.currentStatus ? `CURRENT STATUS: ${input.currentStatus}` : ""}
${input.biggestChallenge ? `BIGGEST CHALLENGE: ${input.biggestChallenge}` : ""}
${input.resources ? `RESOURCES/CONSTRAINTS: ${input.resources}` : ""}

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  "top3Priorities": [
    {
      "rank": <1|2|3>,
      "priority": "<specific priority>",
      "why": "<2 sentence explanation>",
      "timeframe": "<e.g. Next 2 weeks>"
    }
  ],
  "whatToFixFirst": "<specific, actionable first fix>",
  "whatNotToBuildYet": [<3-5 things to avoid building right now>],
  "biggestStrategicMistake": "<honest 2 sentence description of their biggest mistake or risk>",
  "fastestPathToTraction": "<specific 2-3 sentence fastest path>",
  "finalVerdict": "<honest 3-4 sentence executive verdict on viability and path>",
  "confidenceScore": <integer 0-100>,
  "founderSummary": "<5-6 sentence actionable founder brief>",
  "actionableNextSteps": [<5-8 specific next steps ordered by priority>]
}

Be honest, commercially aware, and strategic. Not cheerleading. Not generic.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<DecisionEngineOutput>(text, {
    top3Priorities: [],
    whatToFixFirst: "Analysis failed. Please try again.",
    whatNotToBuildYet: [],
    biggestStrategicMistake: "Analysis failed.",
    fastestPathToTraction: "Analysis failed.",
    finalVerdict: "Analysis failed. Please try again.",
    confidenceScore: 0,
    founderSummary: "Analysis failed.",
    actionableNextSteps: [],
  });
}

// ============================================
// COLDDM AI ENGINE
// ============================================
export async function generateColdDM(input: {
  product: string;
  targetAudience: string;
  tone: string;
  offer: string;
  platform: string;
  personalization?: string;
}): Promise<ColdDMOutput> {
  const client = getClient();

  const includeWhatsapp = input.platform === "whatsapp" || input.platform === "all";
  const includeLinkedin = input.platform === "linkedin" || input.platform === "all";
  const includeEmail = input.platform === "email" || input.platform === "all";

  const prompt = `You are a world-class B2B sales copywriter and outreach specialist. You write cold messages that actually get responses — not spam.

Draft outreach messages for testing:

PRODUCT/SERVICE: ${input.product}
TARGET AUDIENCE: ${input.targetAudience}
TONE: ${input.tone}
OFFER: ${input.offer}
PLATFORM: ${input.platform}
${input.personalization ? `PERSONALIZATION CONTEXT: ${input.personalization}` : ""}

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  ${includeWhatsapp ? `"whatsappMessages": [
    {"variant": "short", "content": "<WhatsApp message under 100 words, punchy>", "tone": "${input.tone}"},
    {"variant": "medium", "content": "<WhatsApp message 100-200 words>", "tone": "${input.tone}"},
    {"variant": "long", "content": "<WhatsApp message 200-300 words, full context>", "tone": "${input.tone}"}
  ],` : ""}
  ${includeLinkedin ? `"linkedinMessages": [
    {"variant": "short", "content": "<LinkedIn DM under 150 words, professional>", "tone": "${input.tone}"},
    {"variant": "medium", "content": "<LinkedIn DM 150-250 words>", "tone": "${input.tone}"},
    {"variant": "long", "content": "<LinkedIn DM 250-400 words, full story>", "tone": "${input.tone}"}
  ],` : ""}
  ${includeEmail ? `"emailMessages": [
    {"subject": "<email subject line>", "body": "<email body 150-250 words>", "variant": "short"},
    {"subject": "<alt email subject>", "body": "<email body 250-400 words>", "variant": "medium"},
    {"subject": "<power email subject>", "body": "<email body 400-600 words>", "variant": "long"}
  ],` : ""}
  "followUpVariants": [
    "<follow-up message #1 after no response>",
    "<follow-up message #2, slightly different angle>",
    "<follow-up message #3, final attempt>"
  ],
  "ctaVariations": [
    "<CTA option 1>",
    "<CTA option 2>",
    "<CTA option 3>",
    "<CTA option 4>"
  ]
}

Make these messages feel human, personalized, and actually likely to get a response. No spam language.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<ColdDMOutput>(text, {
    followUpVariants: [],
    ctaVariations: [],
  });
}

// ============================================
// BRANDFORGE AI ENGINE
// ============================================
export async function generateBrand(input: {
  idea: string;
  tone: string;
  industry: string;
  targetUser: string;
  vibeKeywords: string;
}): Promise<BrandForgeOutput> {
  const client = getClient();

  const prompt = `You are the world's most creative brand strategist and naming expert. You've named brands that became billion-dollar companies. You understand the intersection of linguistics, psychology, culture, and commercial viability.

Create a complete brand identity for this startup:

STARTUP IDEA: ${input.idea}
TONE: ${input.tone}
INDUSTRY: ${input.industry}
TARGET USER: ${input.targetUser}
VIBE KEYWORDS: ${input.vibeKeywords}

Respond ONLY with a valid JSON object. No markdown, no preamble:

{
  "startupNames": [
    {
      "name": "<brand name>",
      "rationale": "<2 sentence rationale for this name>",
      "domain": "<likely .com availability hint>",
      "vibe": "<3-5 words capturing the vibe>"
    },
    {
      "name": "<brand name>",
      "rationale": "<2 sentence rationale>",
      "domain": "<likely .com availability>",
      "vibe": "<3-5 words>"
    },
    {
      "name": "<brand name>",
      "rationale": "<2 sentence rationale>",
      "domain": "<likely .com availability>",
      "vibe": "<3-5 words>"
    },
    {
      "name": "<brand name>",
      "rationale": "<2 sentence rationale>",
      "domain": "<likely .com availability>",
      "vibe": "<3-5 words>"
    },
    {
      "name": "<brand name>",
      "rationale": "<2 sentence rationale>",
      "domain": "<likely .com availability>",
      "vibe": "<3-5 words>"
    }
  ],
  "taglines": [
    "<tagline 1 - punchy, 5-8 words>",
    "<tagline 2 - benefits-focused>",
    "<tagline 3 - emotion-driven>",
    "<tagline 4 - category-defining>"
  ],
  "positioningLines": [
    "<positioning statement 1 - for who / to do what / unlike what>",
    "<positioning statement 2 - different angle>",
    "<positioning statement 3 - category creation angle>"
  ],
  "toneOfVoice": "<3-5 sentence guide on how this brand should sound>",
  "brandPersonality": [
    "<personality trait 1 with 1 sentence description>",
    "<personality trait 2>",
    "<personality trait 3>",
    "<personality trait 4>"
  ],
  "colorDirection": {
    "primary": "<primary color description>",
    "secondary": "<secondary color>",
    "accent": "<accent color>",
    "mood": "<mood description>",
    "hexSuggestions": ["<hex1>", "<hex2>", "<hex3>", "<hex4>", "<hex5>"]
  },
  "brandPackSummary": "<4-5 sentence brand pack summary for a designer brief>"
}

Names should be unique, memorable, pronounceable, and commercially viable.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
  return extractJson<BrandForgeOutput>(text, {
    startupNames: [],
    taglines: [],
    positioningLines: [],
    toneOfVoice: "Analysis failed. Please try again.",
    brandPersonality: [],
    colorDirection: {
      primary: "",
      secondary: "",
      accent: "",
      mood: "",
      hexSuggestions: [],
    },
    brandPackSummary: "Analysis failed.",
  });
}
