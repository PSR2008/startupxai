import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { activatePaidPlan, normalizePaymentBilling } from "@/lib/payment-activation";
import { isPaidPlanKey } from "@/lib/plans";
import { isExpectedRazorpayPlanAmount } from "@/lib/razorpay-plans";

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) return null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Missing payment fields" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!secret || !keyId) {
      return NextResponse.json(
        { success: false, message: "Razorpay is not configured" },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Invalid payment signature" },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const orderPlan = isPaidPlanKey(order.notes?.plan) ? order.notes.plan : null;
    const orderBilling = normalizePaymentBilling(order.notes?.billing);
    const orderUserId = typeof order.notes?.user_id === "string" ? order.notes.user_id : null;
    const orderAmount = typeof order.amount === "number" ? order.amount : Number(order.amount);
    const orderCurrency = String(order.currency || "INR").toUpperCase();

    if (!orderPlan || !isExpectedRazorpayPlanAmount(orderPlan, orderBilling, orderAmount, orderCurrency)) {
      return NextResponse.json(
        { success: false, message: "Payment order does not match an active plan" },
        { status: 400 }
      );
    }

    const userId = await getUserIdFromRequest(req);
    if (!userId || !orderUserId || userId !== orderUserId) {
      return NextResponse.json(
        { success: false, message: "Payment order does not match this account" },
        { status: 403 }
      );
    }

    await activatePaidPlan({
      userId,
      plan: orderPlan,
      billingCycle: orderBilling,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: orderAmount,
      currency: orderCurrency,
      status: "paid",
    });

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Razorpay verify-payment error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
