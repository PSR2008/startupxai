import { z } from "zod";

// ============================================
// ZOD VALIDATION SCHEMAS
// All engine inputs are strictly validated
// ============================================

// --- Shared validators ---
const nonEmptyString = (maxLen: number, fieldName: string) =>
  z
    .string()
    .min(1, `${fieldName} is required`)
    .max(maxLen, `${fieldName} must be ${maxLen} characters or less`)
    .trim();

const optionalString = (maxLen: number) =>
  z
    .string()
    .max(maxLen, `Must be ${maxLen} characters or less`)
    .trim()
    .optional();

const urlField = z
  .string()
  .url("Must be a valid URL (include https://)")
  .max(500, "URL too long")
  .optional()
  .or(z.literal(""));

// --- Idea Engine Schema ---
export const ideaEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  description: nonEmptyString(2000, "Product description"),
  targetAudience: nonEmptyString(500, "Target audience"),
  industry: optionalString(200),
  region: optionalString(200),
  productUrl: urlField,
});

// --- Competitor Intelligence Schema ---
export const competitorEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  competitorNames: optionalString(500),
  industry: optionalString(200),
  startupUrl: urlField,
});

// --- Revenue Engine Schema ---
export const revenueEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  description: nonEmptyString(2000, "Product description"),
  targetAudience: nonEmptyString(500, "Target audience"),
  currentPricing: optionalString(500),
  businessModel: optionalString(300),
});

// --- User Psychology Engine Schema ---
export const psychologyEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  description: nonEmptyString(2000, "Product description"),
  targetAudience: nonEmptyString(500, "Target audience"),
  productUrl: urlField,
  currentCopy: optionalString(2000),
});

// --- Growth Engine Schema ---
export const growthEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  description: nonEmptyString(2000, "Product description"),
  targetAudience: nonEmptyString(500, "Target audience"),
  currentChannels: optionalString(500),
  budget: z
    .enum(["bootstrap", "under-1k", "1k-10k", "10k-50k", "50k+", ""])
    .optional(),
  stage: z
    .enum(["idea", "pre-product", "beta", "launched", "growing", ""])
    .optional(),
});

// --- Founder Decision Engine Schema ---
export const decisionEngineSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  description: nonEmptyString(2000, "Product description"),
  targetAudience: nonEmptyString(500, "Target audience"),
  currentStatus: optionalString(1000),
  biggestChallenge: optionalString(1000),
  resources: optionalString(500),
});

// --- ColdDM AI Schema ---
export const coldDMSchema = z.object({
  product: nonEmptyString(500, "Product/service"),
  targetAudience: nonEmptyString(500, "Target audience"),
  tone: z.enum(["professional", "casual", "bold", "friendly", "urgent"], {
    errorMap: () => ({ message: "Select a valid tone" }),
  }),
  offer: nonEmptyString(500, "Your offer"),
  platform: z.enum(["whatsapp", "linkedin", "email", "all"], {
    errorMap: () => ({ message: "Select a valid platform" }),
  }),
  personalization: optionalString(500),
});

// --- BrandForge AI Schema ---
export const brandForgeSchema = z.object({
  idea: nonEmptyString(500, "Startup idea"),
  tone: z.enum(["premium", "playful", "bold", "minimal", "technical", "warm"], {
    errorMap: () => ({ message: "Select a valid tone" }),
  }),
  industry: nonEmptyString(200, "Industry"),
  targetUser: nonEmptyString(500, "Target user"),
  vibeKeywords: nonEmptyString(500, "Vibe keywords"),
});

// --- Contact / Support Form Schema ---
export const contactFormSchema = z.object({
  name: nonEmptyString(100, "Name"),
  email: z
    .string()
    .email("Please enter a valid email")
    .max(254, "Email too long"),
  subject: nonEmptyString(200, "Subject"),
  message: nonEmptyString(5000, "Message"),
});

// --- Type exports from schemas ---
export type IdeaEngineInput = z.infer<typeof ideaEngineSchema>;
export type CompetitorEngineInput = z.infer<typeof competitorEngineSchema>;
export type RevenueEngineInput = z.infer<typeof revenueEngineSchema>;
export type PsychologyEngineInput = z.infer<typeof psychologyEngineSchema>;
export type GrowthEngineInput = z.infer<typeof growthEngineSchema>;
export type DecisionEngineInput = z.infer<typeof decisionEngineSchema>;
export type ColdDMInput = z.infer<typeof coldDMSchema>;
export type BrandForgeInput = z.infer<typeof brandForgeSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;

// --- Validation helper function ---
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.errors.map(
    (e) => `${e.path.join(".")}: ${e.message}`
  );
  return { success: false, errors };
}
