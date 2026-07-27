import { getSupabaseAdminClient } from "./supabase";
import { getUserEntitlements } from "./entitlements";

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
  | "evidence_engine_started"
  | "evidence_engine_completed"
  | "evidence_engine_failed"
  | "competitor_analysis_started"
  | "competitor_analysis_succeeded"
  | "competitor_analysis_failed"
  | "competitor_analysis_retried"
  | "public_source_preview_started"
  | "public_source_preview_succeeded"
  | "public_source_preview_failed"
  | "public_source_saved"
  | "duplicate_public_source_detected"
  | "google_auth_started"
  | "google_auth_completed"
  | "google_auth_failed"
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
    const entitlementContext = params.userId ? await getUserEntitlements(params.userId) : null;

    const { error } = await admin.from("product_events").insert({
      user_id: params.userId ?? null,
      event_name: eventName,
      properties: {
        ...(params.properties ?? {}),
        ...(entitlementContext
          ? { internal_user: entitlementContext.internalAccess, role: entitlementContext.role }
          : {}),
      },
    });

    if (error) {
      console.error(`[analytics] ${eventName} failed:`, error.message);
    }
  } catch (err) {
    console.error(`[analytics] ${eventName} unexpected:`, err);
  }
}
