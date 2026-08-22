import type { BillingCycle, PaidPlanKey } from "./plans";

export const RAZORPAY_CURRENCY = "INR";

export const RAZORPAY_PLAN_PRICES_INR: Record<PaidPlanKey, Record<BillingCycle, number>> = {
  founder: {
    monthly: 399,
    yearly: 3999,
  },
  growth: {
    monthly: 799,
    yearly: 7999,
  },
  scale: {
    monthly: 1199,
    yearly: 11999,
  },
};

export function getRazorpayPlanAmountPaise(plan: PaidPlanKey, billing: BillingCycle): number {
  return RAZORPAY_PLAN_PRICES_INR[plan][billing] * 100;
}

export function getRazorpayPlanAmountRupees(plan: PaidPlanKey, billing: BillingCycle): number {
  return RAZORPAY_PLAN_PRICES_INR[plan][billing];
}

export function isExpectedRazorpayPlanAmount(
  plan: PaidPlanKey,
  billing: BillingCycle,
  amount: number,
  currency: string
): boolean {
  return currency.toUpperCase() === RAZORPAY_CURRENCY && amount === getRazorpayPlanAmountPaise(plan, billing);
}
