import { getSupabaseAdminClient } from "./supabase";

export interface FounderProfileInput {
  startup_idea: string;
  product_summary: string;
  target_audience: string;
  industry?: string | null;
  founder_stage?: string | null;
  region?: string | null;
  primary_goal?: string | null;
}

export interface FounderProfile extends FounderProfileInput {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export async function getFounderProfile(userId: string): Promise<FounderProfile | null> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return null;

    const { data, error } = await admin
      .from("founder_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[getFounderProfile] failed:", error.message);
      return null;
    }

    return (data as FounderProfile | null) ?? null;
  } catch (err) {
    console.error("[getFounderProfile] unexpected:", err);
    return null;
  }
}

export async function upsertFounderProfile(userId: string, input: FounderProfileInput): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return false;

    const { error } = await admin.from("founder_profiles").upsert({
      user_id: userId,
      startup_idea: input.startup_idea,
      product_summary: input.product_summary,
      target_audience: input.target_audience,
      industry: input.industry || null,
      founder_stage: input.founder_stage || null,
      region: input.region || null,
      primary_goal: input.primary_goal || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[upsertFounderProfile] failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[upsertFounderProfile] unexpected:", err);
    return false;
  }
}
