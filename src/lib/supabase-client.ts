import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================
// BROWSER-SAFE SUPABASE CLIENT
// Uses NEXT_PUBLIC_ vars only — safe for client components
// ============================================

let _client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set these in your .env.local file."
    );
  }

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}

// Convenience alias — used in auth pages
export const supabaseBrowser = {
  get auth() {
    return getSupabaseBrowserClient().auth;
  },
};
