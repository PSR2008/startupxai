/**
 * src/app/api/usage-log/route.ts
 * ─────────────────────────────────────────────────────────────
 * NEW FILE — create at this exact path.
 *
 * POST /api/usage-log
 * Body: { engine_name: string }
 * Auth: Authorization: Bearer <supabase_access_token>
 *
 * Called by logUsageClient() from engine pages after success.
 * Always returns 200 — the client is fire-and-forget.
 * ─────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logUsage } from "@/lib/usage";

const OK = NextResponse.json({ ok: true });

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return OK; // not authenticated — skip silently, still 200

    const body = await req.json().catch(() => ({}));
    const engineName = String(body?.engine_name ?? "unknown");

    await logUsage(userId, engineName);
    return OK;
  } catch {
    // Always 200 — the client doesn't care about failures
    return OK;
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
