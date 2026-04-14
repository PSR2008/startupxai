import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================
// SUPABASE ENV
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================
// CLIENT FACTORIES
// ============================================

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================
// DATABASE HELPERS
// ============================================

export async function saveAnalysis(params: {
  sessionId: string;
  engineType: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  ipHash?: string;
  userId?: string;
}): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();

    if (!admin) {
      console.warn("Supabase admin client not configured. Skipping saveAnalysis.");
      return;
    }

    const { error } = await admin.from("analyses").insert({
      session_id: params.sessionId,
      engine_type: params.engineType,
      input_data: params.inputData,
      output_data: params.outputData,
      ip_hash: params.ipHash,
      user_id: params.userId,
    });

    if (error) {
      console.error("Failed to save analysis:", error.message);
    }
  } catch (err) {
    console.error("Unexpected saveAnalysis error:", err);
  }
}

export async function getRecentAnalyses(
  sessionId: string,
  limit = 10
): Promise<unknown[]> {
  try {
    const client = getSupabaseClient();

    if (!client) {
      console.warn("Supabase client not configured. Returning empty analyses.");
      return [];
    }

    const { data, error } = await client
      .from("analyses")
      .select("id, engine_type, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch analyses:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("Unexpected getRecentAnalyses error:", err);
    return [];
  }
}