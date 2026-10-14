import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import { ApiError } from "../http/api-error";
import { databaseError } from "../launchgate/database";
import type { ReleaseStore } from "../../../services/releases/worker";
export function releaseStore(): ReleaseStore {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL"), key = configuredValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new ApiError("CONFIGURATION_UNAVAILABLE");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async command(action, data) { const response = await client.rpc("lg_release_service", { p_action: action, p_data: data }); databaseError(response.error); return response.data; } };
}
