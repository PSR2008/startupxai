import { getSupabaseAdminClient } from "./supabase";

export type FounderBillingCycle = "monthly" | "yearly";

export interface FounderPaymentActivation {
  userId: string;
  billingCycle: FounderBillingCycle;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  status?: string;
}

export function normalizeFounderBilling(value: unknown): FounderBillingCycle {
  return value === "annual" || value === "yearly" ? "yearly" : "monthly";
}

export function getFounderExpiryDate(billing: FounderBillingCycle): string {
  const expiresAt = new Date();
  if (billing === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt.toISOString();
}

export async function activateFounderPlan(params: FounderPaymentActivation): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client is not configured");

  const normalizedCurrency = params.currency.toUpperCase();
  const paidStatus = params.status ?? "paid";
  const expiresAt = getFounderExpiryDate(params.billingCycle);

  const { data: existingPayment } = await admin
    .from("payments")
    .select("id")
    .eq("razorpay_payment_id", params.razorpayPaymentId)
    .maybeSingle();

  if (!existingPayment) {
    const { error: paymentError } = await admin.from("payments").insert({
      user_id: params.userId,
      plan: "founder",
      billing_cycle: params.billingCycle,
      razorpay_order_id: params.razorpayOrderId,
      razorpay_payment_id: params.razorpayPaymentId,
      amount: params.amount,
      currency: normalizedCurrency,
      status: paidStatus,
    });

    if (paymentError) {
      throw new Error(`Payment insert failed: ${paymentError.message}`);
    }
  }

  const { error: planError } = await admin.from("user_plans").upsert({
    user_id: params.userId,
    plan: "founder",
    billing_cycle: params.billingCycle,
    active: true,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (planError) {
    throw new Error(`Plan activation failed: ${planError.message}`);
  }
}
