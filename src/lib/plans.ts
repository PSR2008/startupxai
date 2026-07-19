export const PLANS = {
  free: {
    key: "free",
    label: "Starter",
    analysesPerMonth: 5,
    monthlyPrice: 0,
    yearlyPrice: 0,
  },
  founder: {
    key: "founder",
    label: "Founder",
    analysesPerMonth: 50,
    monthlyPrice: 5,
    yearlyPrice: 49,
  },
  growth: {
    key: "growth",
    label: "Growth",
    analysesPerMonth: 150,
    monthlyPrice: 10,
    yearlyPrice: 99,
  },
  scale: {
    key: "scale",
    label: "Scale",
    analysesPerMonth: 400,
    monthlyPrice: 15,
    yearlyPrice: 149,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "free">;
export type BillingCycle = "monthly" | "yearly";
export type EngineId =
  | "idea"
  | "competitor"
  | "revenue"
  | "psychology"
  | "growth"
  | "decision";
export type GenerationFeature = "cold-dm" | "brand-forge";
export type ProcessingPriority = "standard" | "fast" | "priority";
export type SupportLevel = "community" | "email" | "priority";

export interface PlanEntitlements {
  monthlyAnalyses: number;
  allowedEngines: EngineId[] | "all";
  coldDmMonthlyLimit: number;
  brandForgeMonthlyLimit: number;
  canExportPdf: boolean;
  canGenerateInvestorMemo: boolean;
  canGenerateSlideSummary: boolean;
  canShareReports: boolean;
  canSaveHistory: boolean;
  canCompareAnalyses: boolean;
  startupWorkspaceLimit: number;
  processingPriority: ProcessingPriority;
  supportLevel: SupportLevel;
  canUseCustomReportBranding: boolean;
  teamReady: boolean;
}

export const PLAN_ENTITLEMENTS: Record<PlanKey, PlanEntitlements> = {
  free: {
    monthlyAnalyses: 5,
    allowedEngines: ["idea", "competitor"],
    coldDmMonthlyLimit: 2,
    brandForgeMonthlyLimit: 2,
    canExportPdf: false,
    canGenerateInvestorMemo: false,
    canGenerateSlideSummary: false,
    canShareReports: false,
    canSaveHistory: false,
    canCompareAnalyses: false,
    startupWorkspaceLimit: 1,
    processingPriority: "standard",
    supportLevel: "community",
    canUseCustomReportBranding: false,
    teamReady: false,
  },
  founder: {
    monthlyAnalyses: 50,
    allowedEngines: "all",
    coldDmMonthlyLimit: 25,
    brandForgeMonthlyLimit: 25,
    canExportPdf: true,
    canGenerateInvestorMemo: true,
    canGenerateSlideSummary: true,
    canShareReports: false,
    canSaveHistory: true,
    canCompareAnalyses: false,
    startupWorkspaceLimit: 1,
    processingPriority: "standard",
    supportLevel: "email",
    canUseCustomReportBranding: false,
    teamReady: false,
  },
  growth: {
    monthlyAnalyses: 150,
    allowedEngines: "all",
    coldDmMonthlyLimit: 100,
    brandForgeMonthlyLimit: 100,
    canExportPdf: true,
    canGenerateInvestorMemo: true,
    canGenerateSlideSummary: true,
    canShareReports: true,
    canSaveHistory: true,
    canCompareAnalyses: false,
    startupWorkspaceLimit: 3,
    processingPriority: "fast",
    supportLevel: "priority",
    canUseCustomReportBranding: false,
    teamReady: false,
  },
  scale: {
    monthlyAnalyses: 400,
    allowedEngines: "all",
    coldDmMonthlyLimit: 300,
    brandForgeMonthlyLimit: 300,
    canExportPdf: true,
    canGenerateInvestorMemo: true,
    canGenerateSlideSummary: true,
    canShareReports: true,
    canSaveHistory: true,
    canCompareAnalyses: false,
    startupWorkspaceLimit: 10,
    processingPriority: "priority",
    supportLevel: "priority",
    canUseCustomReportBranding: false,
    teamReady: true,
  },
};

export const ENGINE_LABELS: Record<EngineId, string> = {
  idea: "Idea & Market Engine",
  competitor: "Competitor Intelligence",
  revenue: "Revenue Engine",
  psychology: "User Psychology Engine",
  growth: "Growth Engine",
  decision: "Founder Decision Engine",
};

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === "annual" || value === "yearly" ? "yearly" : "monthly";
}

export function getPlanLabel(plan: PlanKey): string {
  return PLANS[plan]?.label ?? PLANS.free.label;
}

export function getPlanEntitlements(plan: PlanKey): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS.free;
}

export function canUseEngine(plan: PlanKey, engine: EngineId): boolean {
  const allowed = getPlanEntitlements(plan).allowedEngines;
  return allowed === "all" || allowed.includes(engine);
}

export function getGenerationLimit(plan: PlanKey, feature: GenerationFeature): number {
  const entitlements = getPlanEntitlements(plan);
  return feature === "cold-dm"
    ? entitlements.coldDmMonthlyLimit
    : entitlements.brandForgeMonthlyLimit;
}

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return value === "founder" || value === "growth" || value === "scale";
}

export function getPlanPriceCents(plan: PaidPlanKey, billing: BillingCycle): number {
  const price = billing === "yearly" ? PLANS[plan].yearlyPrice : PLANS[plan].monthlyPrice;
  return price * 100;
}

export function getAllowedPaidAmounts(discountPercent = 20): number[] {
  const amounts = (["founder", "growth", "scale"] as PaidPlanKey[]).flatMap((plan) =>
    (["monthly", "yearly"] as BillingCycle[]).flatMap((billing) => {
      const base = getPlanPriceCents(plan, billing);
      const discounted = discountPercent > 0 && discountPercent < 100
        ? Math.max(Math.round(base * ((100 - discountPercent) / 100)), 100)
        : base;
      return [base, discounted];
    })
  );
  return Array.from(new Set(amounts));
}
