import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan = "founder", billing = "monthly" } = body ?? {};

    const prices = {
      founder: {
        monthly: 4900, // ₹49.00 if you want rupees, change to 4900 for ₹49? usually 4900 = ₹49.00? No: ₹49.00 = 4900 paise
        annual: 49900,
      },
      studio: {
        monthly: 14900,
        annual: 119000,
      },
    } as const;

    const selectedPlan =
      plan in prices ? (plan as keyof typeof prices) : "founder";
    const selectedBilling =
      billing === "annual" ? "annual" : "monthly";

    const amount = prices[selectedPlan][selectedBilling];

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `startupx_${selectedPlan}_${selectedBilling}_${Date.now()}`,
      notes: {
        plan: selectedPlan,
        billing: selectedBilling,
      },
    });

    return NextResponse.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay create-order error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create order" },
      { status: 500 }
    );
  }
}