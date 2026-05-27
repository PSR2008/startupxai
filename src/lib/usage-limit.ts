import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUsageSummary } from "./usage";
import { PLANS } from "./plans";

export interface UsageLimitCheck {
  allowed: boolean;
  userId: string | null;
  response?: NextResponse;
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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

export async function checkUsageLimit(req: NextRequest): Promise<UsageLimitCheck> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return { allowed: true, userId: null };

  const usage = await getUsageSummary(userId);
  if (usage.analyses_remaining > 0) return { allowed: true, userId };

  return {
    allowed: false,
    userId,
    response: NextResponse.json(
      {
        success: false,
        code: "USAGE_LIMIT_REACHED",
        error:
          usage.plan === "free"
            ? `You have used all ${PLANS.free.analysesPerMonth} free analyses this month. Upgrade for 50, 100, or 200 analyses/month.`
            : "You have reached your monthly analysis limit.",
        usage,
      },
      { status: 402 },
    ),
  };
}
