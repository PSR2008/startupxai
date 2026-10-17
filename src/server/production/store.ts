import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import type { OperationsStore } from "../../../services/production/contracts";
import { capabilitySchema, environmentSchema, statusSchema } from "../../../services/production/contracts";
import { z } from "zod";
import type { Qualification } from "../../../services/production/readiness";
export function operationsStore(): OperationsStore {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL"), key = configuredValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("OPERATIONS_DATABASE_UNAVAILABLE");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { async command(action, data) { const r = await client.rpc("lg_operations_service", { p_action: action, p_data: data }); if (r.error) throw new Error("OPERATIONS_DATABASE_FAILURE"); return r.data; } };
}
/** Bind trusted service results to the requested tenant/environment before use. */
export function qualificationReader(store:OperationsStore,organizationId:string,environment:z.infer<typeof environmentSchema>){
  z.string().uuid().parse(organizationId);environmentSchema.parse(environment);
  return async():Promise<Qualification[]>=>{
    const rows=z.array(z.object({organization_id:z.literal(organizationId),environment:z.literal(environment),capability:capabilitySchema,status:statusSchema,evidence_digest:z.string().nullable(),live:z.boolean(),observed_at:z.string(),expires_at:z.string()})).parse(await store.command("QUALIFICATIONS",{organizationId,environment}));
    return rows.map(r=>({capability:r.capability,environment:r.environment,status:r.status,evidenceDigest:r.evidence_digest,live:r.live,observedAt:Date.parse(r.observed_at),expiresAt:Date.parse(r.expires_at)}));
  };
}
