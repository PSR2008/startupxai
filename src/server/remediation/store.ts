import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import { ApiError } from "../http/api-error";
import { databaseError } from "../launchgate/database";
import type { RemediationStore } from "../../../services/remediation/contracts";
export function remediationStore(): RemediationStore {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL"), key = configuredValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new ApiError("CONFIGURATION_UNAVAILABLE");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async command(action, data) { const r = await client.rpc("lg_fix_service", { p_action: action, p_data: data }); databaseError(r.error); return r.data; } };
}
