export const PLANS = {
  free: {
    key: "free",
    label: "Free",
    analysesPerMonth: 15,
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
    analysesPerMonth: 100,
    monthlyPrice: 10,
    yearlyPrice: 99,
  },
  scale: {
    key: "scale",
    label: "Scale",
    analysesPerMonth: 200,
    monthlyPrice: 15,
    yearlyPrice: 149,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "free">;
export type BillingCycle = "monthly" | "yearly";

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === "annual" || value === "yearly" ? "yearly" : "monthly";
}

export function getPlanLabel(plan: PlanKey): string {
  return PLANS[plan]?.label ?? PLANS.free.label;
}

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return value === "founder" || value === "growth" || value === "scale";
}

export function getPlanPriceCents(plan: PaidPlanKey, billing: BillingCycle): number {
  const price = billing === "yearly" ? PLANS[plan].yearlyPrice : PLANS[plan].monthlyPrice;
  return price * 100;
}

export function getAllowedPaidAmounts(): number[] {
  const amounts = (["founder", "growth", "scale"] as PaidPlanKey[]).flatMap((plan) =>
    (["monthly", "yearly"] as BillingCycle[]).flatMap((billing) => {
      const base = getPlanPriceCents(plan, billing);
      return [base, Math.max(Math.round(base * 0.8), 100)];
    })
  );
  return Array.from(new Set(amounts));
}
