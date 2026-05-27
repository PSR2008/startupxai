import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { getPlanPriceCents, isPaidPlanKey, normalizeBillingCycle } from "@/lib/plans";

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
    const { plan = "founder", billing = "monthly", coupon = "" } = body ?? {};

    const selectedPlan = isPaidPlanKey(plan) ? plan : "founder";
    const normalizedBilling = normalizeBillingCycle(billing);
    const selectedBilling = normalizedBilling === "yearly" ? "annual" : "monthly";
    const baseAmount = getPlanPriceCents(selectedPlan, normalizedBilling);
    const couponCode = String(coupon || "").trim().toUpperCase();
    const discount = couponCode === "FOUNDER20" ? Math.round(baseAmount * 0.2) : 0;
    const amount = Math.max(baseAmount - discount, 100);

    const order = await razorpay.orders.create({
      amount,
      currency: "USD",
      receipt: `startupx_${selectedPlan}_${selectedBilling}_${Date.now()}`,
      notes: {
        plan: selectedPlan,
        billing: selectedBilling,
        user_id: userId,
        coupon: discount > 0 ? couponCode : "",
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
