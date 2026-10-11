import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import { ApiError } from "../http/api-error";
import { databaseError } from "../launchgate/database";

export type SourceCommand="READ_SETUP"|"BIND"|"WEBHOOK"|"CLAIM"|"CHECK"|"COMPLETE"|"FAIL";
export interface SourceStore { command(action:SourceCommand,data:Record<string,unknown>):Promise<unknown> }
/** Isolated provider/worker privilege. No client/from()/arbitrary RPC exported.
 * Migration 017 grants only lg_source_service, never browser-supplied facts. */
export function sourceStore():SourceStore {
  const url=configuredValue("NEXT_PUBLIC_SUPABASE_URL"),key=configuredValue("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)throw new ApiError("CONFIGURATION_UNAVAILABLE");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {async command(action,data){const response=await client.rpc("lg_source_service",{p_action:action,p_data:data});databaseError(response.error);return response.data;}};
}
