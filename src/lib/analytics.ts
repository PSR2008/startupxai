import { getSupabaseAdminClient } from "./supabase";

export type ProductEventName =
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "engine_used"
  | "report_generation_started"
  | "detailed_report_generated"
  | "investor_memo_generated"
  | "slide_summary_generated"
  | "pdf_downloaded"
  | "share_link_created"
  | "share_link_copied"
  | "share_link_opened"
  | "share_link_revoked"
  | "report_generation_failed"
  | "pricing_engine_started"
  | "pricing_engine_completed"
  | "pricing_scenario_selected"
  | "upgrade_prompt_viewed"
  | "upgrade_clicked"
  | "checkout_started"
  | "subscription_completed";

export async function trackProductEvent(
  eventName: ProductEventName,
  params: {
    userId?: string | null;
    properties?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return;

    const { error } = await admin.from("product_events").insert({
      user_id: params.userId ?? null,
      event_name: eventName,
      properties: params.properties ?? {},
    });

    if (error) {
      console.error(`[analytics] ${eventName} failed:`, error.message);
    }
  } catch (err) {
    console.error(`[analytics] ${eventName} unexpected:`, err);
  }
}
