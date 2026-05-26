// ============================================
// CORE APPLICATION TYPES
// ============================================

// --- Engine Input Types ---

export interface IdeaEngineInput {
  idea: string;
  description: string;
  targetAudience: string;
  industry?: string;
  region?: string;
  productUrl?: string;
}

export interface CompetitorEngineInput {
  idea: string;
  competitorNames?: string;
  industry?: string;
  startupUrl?: string;
}

export interface RevenueEngineInput {
  idea: string;
  description: string;
  targetAudience: string;
  currentPricing?: string;
  businessModel?: string;
}

export interface PsychologyEngineInput {
  idea: string;
  description: string;
  targetAudience: string;
  productUrl?: string;
  currentCopy?: string;
}

export interface GrowthEngineInput {
  idea: string;
  description: string;
  targetAudience: string;
  currentChannels?: string;
  budget?: string;
  stage?: string;
}

export interface DecisionEngineInput {
  idea: string;
  description: string;
  targetAudience: string;
  currentStatus?: string;
  biggestChallenge?: string;
  resources?: string;
}

export interface ColdDMInput {
  product: string;
  targetAudience: string;
  tone: "professional" | "casual" | "bold" | "friendly" | "urgent";
  offer: string;
  platform: "whatsapp" | "linkedin" | "email" | "all";
  personalization?: string;
}

export interface BrandForgeInput {
  idea: string;
  tone: "premium" | "playful" | "bold" | "minimal" | "technical" | "warm";
  industry: string;
  targetUser: string;
  vibeKeywords: string;
}

// --- Engine Output Types ---

export interface IdeaEngineOutput {
  marketDemandScore: number; // 0-100
  ideaClarityScore: number; // 0-100
  riskFactors: string[];
  assumptionsDetected: string[];
  whyItMayFail: string[];
  hiddenOpportunities: string[];
  differentiationSuggestions: string[];
  idealICP: string[];
  categoryPositioning: string;
  overallVerdict: string;
  executiveSummary: string;
}

export interface CompetitorEngineOutput {
  directCompetitors: Competitor[];
  indirectCompetitors: Competitor[];
  positioningGaps: string[];
  howToBeatThem: string[];
  whiteSpaceOpportunities: string[];
  comparisonSummary: string;
  strategicAdvantage: string;
}

export interface Competitor {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  url?: string;
}

export interface RevenueEngineOutput {
  pricingSuggestions: PricingTier[];
  monetizationModels: MonetizationModel[];
  psychologicalPricingTips: string[];
  revenueLeaks: string[];
  conversionBlockers: string[];
  upsellOpportunities: string[];
  revenueVerdict: string;
}

export interface PricingTier {
  name: string;
  price: string;
  billingCycle: string;
  features: string[];
  recommended?: boolean;
  targetSegment: string;
}

export interface MonetizationModel {
  model: string;
  description: string;
  pros: string[];
  cons: string[];
  fitScore: number;
}

export interface PsychologyEngineOutput {
  trustScore: number; // 0-100
  brutalRoast: string;
  credibilityGaps: string[];
  frictionPoints: string[];
  firstImpressionIssues: string[];
  confusingCopyIssues: string[];
  emotionalObjections: string[];
  uxRecommendations: string[];
  trustBuildingActions: string[];
}

export interface GrowthEngineOutput {
  first10CustomersPlan: GrowthStep[];
  channelSuggestions: GrowthChannel[];
  audienceSegments: string[];
  contentHooks: string[];
  campaignSuggestions: string[];
  launchSteps: string[];
  outreachDirection: OutreachDirection;
  customerAcquisitionPriorities: string[];
}

export interface GrowthStep {
  step: number;
  action: string;
  timeline: string;
  expectedOutcome: string;
}

export interface GrowthChannel {
  channel: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  description: string;
  tactics: string[];
}

export interface OutreachDirection {
  whatsapp: string;
  linkedin: string;
  email: string;
}

export interface DecisionEngineOutput {
  top3Priorities: Priority[];
  whatToFixFirst: string;
  whatNotToBuildYet: string[];
  biggestStrategicMistake: string;
  fastestPathToTraction: string;
  finalVerdict: string;
  confidenceScore: number; // 0-100
  founderSummary: string;
  actionableNextSteps: string[];
}

export interface Priority {
  rank: number;
  priority: string;
  why: string;
  timeframe: string;
}

export interface ColdDMOutput {
  whatsappMessages?: ColdMessage[];
  linkedinMessages?: ColdMessage[];
  emailMessages?: ColdEmailMessage[];
  followUpVariants: string[];
  ctaVariations: string[];
}

export interface ColdMessage {
  variant: "short" | "medium" | "long";
  content: string;
  tone: string;
}

export interface ColdEmailMessage {
  subject: string;
  body: string;
  variant: "short" | "medium" | "long";
}

export interface BrandForgeOutput {
  startupNames: BrandName[];
  taglines: string[];
  positioningLines: string[];
  toneOfVoice: string;
  brandPersonality: string[];
  colorDirection: ColorDirection;
  brandPackSummary: string;
}

export interface BrandName {
  name: string;
  rationale: string;
  domain?: string;
  vibe: string;
}

export interface ColorDirection {
  primary: string;
  secondary: string;
  accent: string;
  mood: string;
  hexSuggestions: string[];
}

// --- API Response Types ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// --- UI Types ---

export type EngineStatus = "idle" | "loading" | "success" | "error";

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  isNew?: boolean;
}

export interface ScoreConfig {
  score: number;
  label: string;
  color: "green" | "yellow" | "red" | "blue";
}

// --- Supabase DB Types ---

export interface AnalysisRecord {
  id: string;
  created_at: string;
  user_id?: string;
  session_id: string;
  engine_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  ip_hash?: string;
}
