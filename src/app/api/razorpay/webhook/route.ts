import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import crypto from "crypto";
import { activatePaidPlan, normalizePaymentBilling } from "@/lib/payment-activation";
import { getAllowedPaidAmounts, isPaidPlanKey } from "@/lib/plans";
import { getPaymentCouponDiscountPercent } from "@/lib/payment-coupons";

export const runtime = "nodejs";

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
}

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret || !keyId || !keySecret) {
      return NextResponse.json(
        { success: false, message: "Razorpay webhook is not configured" },
        { status: 500 }
      );
    }

    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const rawBody = await req.text();

    if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);
    const payment = event?.payload?.payment?.entity as RazorpayPaymentEntity | undefined;

    if (String(event?.event) !== "payment.captured") {
      return NextResponse.json({ success: true, ignored: true });
    }

    if (!payment?.id || !payment.order_id) {
      return NextResponse.json(
        { success: false, message: "Missing payment payload" },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.fetch(payment.order_id);
    const orderPlan = isPaidPlanKey(order.notes?.plan) ? order.notes.plan : null;
    const billingCycle = normalizePaymentBilling(order.notes?.billing);
    const userId = typeof order.notes?.user_id === "string" ? order.notes.user_id : null;
    const orderAmount = typeof order.amount === "number" ? order.amount : Number(order.amount);
    const currency = String(order.currency || payment.currency || "USD").toUpperCase();

    if (!userId || !orderPlan || currency !== "USD" || !getAllowedPaidAmounts(getPaymentCouponDiscountPercent()).includes(orderAmount)) {
      return NextResponse.json(
        { success: false, message: "Webhook payment does not match an active plan" },
        { status: 400 }
      );
    }

    await activatePaidPlan({
      userId,
      plan: orderPlan,
      billingCycle,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amount: orderAmount,
      currency,
      status: payment.status === "captured" ? "paid" : String(payment.status || "paid"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json(
      { success: false, message: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
