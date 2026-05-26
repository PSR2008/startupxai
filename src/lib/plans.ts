export const PLANS = {
  free: {
    key: "free",
    label: "Free",
    analysesPerMonth: 15,
  },
  founder: {
    key: "founder",
    label: "Founder",
    analysesPerMonth: 500,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingCycle = "monthly" | "yearly";

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === "annual" || value === "yearly" ? "yearly" : "monthly";
}

export function getPlanLabel(plan: PlanKey): string {
  return PLANS[plan]?.label ?? PLANS.free.label;
}
