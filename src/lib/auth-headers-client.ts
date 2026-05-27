"use client";

import { getSupabaseBrowserClient } from "./supabase-client";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}
