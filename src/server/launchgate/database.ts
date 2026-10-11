import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import { ApiError } from "../http/api-error";
import { isVerifiedPrincipal, type VerifiedPrincipal } from "../auth/principal";
import { type AuthorizationReader } from "./authorization";
import { membershipSchema, type Project } from "./domain";

export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new ApiError("ACCESS_DENIED");
  if (error.code?.startsWith("22") || error.code?.startsWith("23")) throw new ApiError("INVALID_REQUEST");
  throw new ApiError("INTERNAL_ERROR", { cause: error });
}
/** Request scoped. Uses ONLY the anon key plus the caller's verified bearer token. */
export function userDatabase(request: Request, principal: VerifiedPrincipal): SupabaseClient {
  if (!isVerifiedPrincipal(principal)) throw new ApiError("AUTHENTICATION_REQUIRED");
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = configuredValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) throw new ApiError("CONFIGURATION_UNAVAILABLE");
  const authorization = request.headers.get("authorization");
  if (!authorization) throw new ApiError("AUTHENTICATION_REQUIRED");
  return createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export function authorizationReader(db: SupabaseClient): AuthorizationReader {
  return {
    async membership(organizationId, userId, allowPending = false) {
      // Pending-org audit/deletion reads use their own RLS and do not re-enable normal access.
      if (allowPending) {
        const { data, error } = await db.rpc("lg_read_security_membership", { p_organization: organizationId }).maybeSingle();
        databaseError(error);
        return data ? membershipSchema.parse(data) : null;
      }
      const { data, error } = await db.from("lg_organization_memberships").select("id,organization_id,user_id,role,status").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "ACTIVE").maybeSingle();
      databaseError(error);
      return data ? membershipSchema.parse(data) : null;
    },
    async project(projectId) {
      const { data, error } = await db.from("lg_projects").select("id,organization_id,status").eq("id", projectId).maybeSingle();
      databaseError(error);
      return data as Project | null;
    },
  };
}
