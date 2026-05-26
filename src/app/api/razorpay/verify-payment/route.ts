import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";

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

function getExpiryDate(billing: string): string {
  const expiresAt = new Date();
  if (billing === "annual" || billing === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = "founder",
      billing = "monthly",
      amount = null,
      currency = "USD",
    } = body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Missing payment fields" },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
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

    const userId = await getUserIdFromRequest(req);
    const admin = getSupabaseAdminClient();
    const normalizedBilling = billing === "annual" || billing === "yearly" ? "yearly" : "monthly";

    if (userId && admin && plan === "founder") {
      const expiresAt = getExpiryDate(normalizedBilling);

      await admin.from("payments").insert({
        user_id: userId,
        plan: "founder",
        billing_cycle: normalizedBilling,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        currency,
        status: "paid",
      });

      await admin.from("user_plans").upsert({
        user_id: userId,
        plan: "founder",
        billing_cycle: normalizedBilling,
        active: true,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
    }

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
