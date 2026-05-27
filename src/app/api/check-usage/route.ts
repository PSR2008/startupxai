import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUsageSummary } from "@/lib/usage";
import { PLANS } from "@/lib/plans";

const FREE_USAGE = {
  plan: "free",
  billing_cycle: null,
  monthly_limit: PLANS.free.analysesPerMonth,
  analyses_used: 0,
  analyses_remaining: PLANS.free.analysesPerMonth,
  expires_at: null,
};

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json(FREE_USAGE);

    const summary = await getUsageSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[check-usage] error:", error);
    return NextResponse.json(FREE_USAGE);
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
