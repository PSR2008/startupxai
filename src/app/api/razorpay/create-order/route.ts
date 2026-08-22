import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { isPaidPlanKey, normalizeBillingCycle } from "@/lib/plans";
import { getRazorpayPlanAmountPaise, RAZORPAY_CURRENCY } from "@/lib/razorpay-plans";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Please sign in before upgrading" },
        { status: 401 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, message: "Razorpay is not configured" },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const body = await req.json();
    const { plan = "founder", billing = "monthly" } = body ?? {};

    const selectedPlan = isPaidPlanKey(plan) ? plan : "founder";
    const normalizedBilling = normalizeBillingCycle(billing);
    const amount = getRazorpayPlanAmountPaise(selectedPlan, normalizedBilling);

    const order = await razorpay.orders.create({
      amount,
      currency: RAZORPAY_CURRENCY,
      receipt: `startupx_${selectedPlan}_${normalizedBilling}_${Date.now()}`,
      notes: {
        plan: selectedPlan,
        billing: normalizedBilling,
        user_id: userId,
      },
    });

    return NextResponse.json({
      success: true,
      order,
      key: keyId,
    });
  } catch (error) {
    console.error("Razorpay create-order error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create order" },
      { status: 500 }
    );
  }
}
