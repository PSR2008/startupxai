/**
 * src/app/api/check-usage/route.ts
 * ─────────────────────────────────────────────────────────────
 * NEW FILE — create at this exact path.
 *
 * GET /api/check-usage
 *
 * Returns the authenticated user's plan + monthly usage summary.
 * Called by the UsageWidget dashboard component.
 *
 * Auth: reads Supabase user from Authorization: Bearer <token>
 * Falls back to Free defaults for unauthenticated requests
 * (never 401 — the dashboard should always render).
 * ─────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUsageSummary } from "@/lib/usage";

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
      }
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

    if (!userId) {
      // Unauthenticated — return free defaults so the dashboard
      // still renders rather than showing an error state
      return NextResponse.json({
        plan:                "free",
        billing_cycle:       null,
        monthly_limit:       15,
        analyses_used:       0,
        analyses_remaining:  15,
        expires_at:          null,
      });
    }

    const summary = await getUsageSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[check-usage] error:", error);
    // Always return 200 with free defaults — never crash the dashboard
    return NextResponse.json({
      plan:                "free",
      billing_cycle:       null,
      monthly_limit:       15,
      analyses_used:       0,
      analyses_remaining:  15,
      expires_at:          null,
    });
  }
}

// Reject non-GET
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
