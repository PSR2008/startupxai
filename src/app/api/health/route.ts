import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    razorpayKeyId: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpayKeySecret: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookSecret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };

  return NextResponse.json(
    {
      status: "ok",
      service: "StartupX AI",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks,
    },
    { status: 200 }
  );
}
