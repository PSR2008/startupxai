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

export async function getRecentAnalysesByUser(
  userId: string,
  limit = 8
): Promise<unknown[]> {
  try {
    const admin = getSupabaseAdminClient();

    if (!admin) {
      console.warn("Supabase client not configured. Returning empty analyses.");
      return [];
    }

    const { data, error } = await admin
      .from("analyses")
      .select("id, engine_type, input_data, output_data, created_at")
      .eq("user_id", userId)
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

export async function getAnalysisByUser(params: {
  userId: string;
  analysisId: string;
}): Promise<unknown | null> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return null;

    const { data, error } = await admin
      .from("analyses")
      .select("id, engine_type, input_data, output_data, created_at")
      .eq("id", params.analysisId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch analysis:", error.message);
      return null;
    }

    return data ?? null;
  } catch (err) {
    console.error("Unexpected getAnalysisByUser error:", err);
    return null;
  }
}

export async function deleteAnalysisByUser(params: {
  userId: string;
  analysisId: string;
}): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return false;

    const { error } = await admin
      .from("analyses")
      .delete()
      .eq("id", params.analysisId)
      .eq("user_id", params.userId);

    if (error) {
      console.error("Failed to delete analysis:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected deleteAnalysisByUser error:", err);
    return false;
  }
}

export async function clearAnalysesByUser(userId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return false;

    const { error } = await admin.from("analyses").delete().eq("user_id", userId);

    if (error) {
      console.error("Failed to clear analyses:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected clearAnalysesByUser error:", err);
    return false;
  }
}

export async function getReportStatsByUser(userId: string): Promise<{
  totalReports: number;
  mostUsedEngine: string | null;
  lastAnalysisAt: string | null;
}> {
  const fallback = { totalReports: 0, mostUsedEngine: null, lastAnalysisAt: null };

  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return fallback;

    const { data, error } = await admin
      .from("analyses")
      .select("engine_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data) {
      if (error) console.error("Failed to fetch report stats:", error.message);
      return fallback;
    }

    const engineCounts = data.reduce<Record<string, number>>((acc, row) => {
      const engine = String(row.engine_type || "unknown");
      acc[engine] = (acc[engine] ?? 0) + 1;
      return acc;
    }, {});
    const mostUsedEngine = Object.entries(engineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      totalReports: data.length,
      mostUsedEngine,
      lastAnalysisAt: data[0]?.created_at ?? null,
    };
  } catch (err) {
    console.error("Unexpected getReportStatsByUser error:", err);
    return fallback;
  }
}

export async function getPaymentsByUser(userId: string, limit = 5): Promise<unknown[]> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return [];

    const { data, error } = await admin
      .from("payments")
      .select("id, plan, billing_cycle, amount, currency, status, created_at, razorpay_payment_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch payments:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("Unexpected getPaymentsByUser error:", err);
    return [];
  }
}
