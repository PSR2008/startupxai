import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { authFailureRedirect, normalizeAuthNextPath } from "@/lib/auth-flow";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { trackProductEvent } from "@/lib/analytics";

export const runtime = "nodejs";

async function createSupabaseCallbackClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();
  const responseCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        responseCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
  return { supabase, responseCookies };
}

async function initializeOAuthUser(userId: string) {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return;
    await admin.from("user_roles").upsert(
      {
        user_id: userId,
        role: "user",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
  } catch {
    // Login must not fail if optional role bootstrap is unavailable.
  }
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeAuthNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    await trackProductEvent("google_auth_failed", { properties: { reason: "missing_code" } });
    return NextResponse.redirect(authFailureRedirect(requestUrl.origin));
  }

  const callbackClient = await createSupabaseCallbackClient();
  if (!callbackClient) {
    await trackProductEvent("google_auth_failed", { properties: { reason: "supabase_unavailable" } });
    return NextResponse.redirect(authFailureRedirect(requestUrl.origin));
  }

  const {
    data: { user },
    error,
  } = await callbackClient.supabase.auth.exchangeCodeForSession(code);

  if (error || !user) {
    await trackProductEvent("google_auth_failed", { properties: { reason: "exchange_failed" } });
    return NextResponse.redirect(authFailureRedirect(requestUrl.origin));
  }

  await initializeOAuthUser(user.id);
  await trackProductEvent("google_auth_completed", {
    userId: user.id,
    properties: { provider: "google" },
  });

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  callbackClient.responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
