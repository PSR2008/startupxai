import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";

export interface VerifiedPrincipal {
  readonly userId: string;
  readonly origin: "supabase_verified_bearer";
}
export type TokenVerifier = (token: string) => Promise<{ userId: string } | null>;
async function verifySupabaseToken(token: string): Promise<{ userId: string } | null> {
  const url = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const key = configuredValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && data.user ? { userId: data.user.id } : null;
}
/** verifier is a trusted server dependency, never request data. */
export async function principalFromRequest(request: Pick<Request, "headers">, verifier: TokenVerifier = verifySupabaseToken): Promise<VerifiedPrincipal | null> {
  const match = /^Bearer\s+(\S+)$/i.exec((request.headers.get("authorization") ?? "").trim());
  if (!match) return null;
  try {
    const identity = await verifier(match[1]);
    return identity?.userId ? Object.freeze({ userId: identity.userId, origin: "supabase_verified_bearer" as const }) : null;
  } catch { return null; }
}
