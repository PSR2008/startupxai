/**
 * src/lib/usage-client.ts
 * ─────────────────────────────────────────────────────────────
 * NEW FILE — create at src/lib/usage-client.ts
 *
 * Client-side helper that logs usage after a successful engine analysis.
 *
 * Usage (add to each engine page after setStatus("success")):
 *
 *   import { logUsageClient } from "@/lib/usage-client";
 *
 *   // Inside your success handler, after setResult(data.data):
 *   setStatus("success");
 *   logUsageClient("idea");    // non-blocking, fire-and-forget
 *
 * Engine name slugs:
 *   "idea"        → Idea & Market Engine
 *   "competitor"  → Competitor Intelligence
 *   "revenue"     → Revenue Engine
 *   "psychology"  → User Psychology Engine
 *   "growth"      → Growth Engine
 *   "decision"    → Founder Decision Engine
 *   "brand-forge" → BrandForge
 *   "cold-dm"     → ColdDM
 *   "improve-idea"→ Improve Idea
 *
 * Design:
 *   - Never throws, never blocks the UI
 *   - Reads the Supabase session token from the browser client
 *   - Calls POST /api/usage-log with Authorization header
 *   - If user not logged in → request is still sent, server skips silently
 * ─────────────────────────────────────────────────────────────
 */
import { getSupabaseBrowserClient } from "./supabase-client";

/**
 * Fire-and-forget usage logger.
 * Call this client-side after any successful engine analysis.
 *
 * @param engineName  Short slug for the engine (e.g. "idea", "competitor")
 */
export function logUsageClient(engineName: string): void {
  // Run async in background — never await this
  void (async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      await fetch("/api/usage-log", {
        method: "POST",
        headers,
        body: JSON.stringify({ engine_name: engineName }),
      });
      // Response is intentionally ignored — fire-and-forget
    } catch {
      // Never surface errors to the user — this is background telemetry
    }
  })();
}
