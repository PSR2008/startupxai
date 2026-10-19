"use client";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
export class ProductError extends Error { constructor(public code: string, public correlationId?: string) { super(code); } }
export async function api<T = unknown>(path: string, data?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) throw new ProductError("AUTHENTICATION_REQUIRED");
  const response = await fetch(`/api/v1/${path}`, { method: data === undefined ? "GET" : method, headers: { Authorization: `Bearer ${session.access_token}`, ...(data === undefined ? {} : { "Content-Type": "application/json" }) }, body: data === undefined ? undefined : JSON.stringify(data), cache: "no-store", signal });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new ProductError(payload.error?.code ?? "REQUEST_FAILED", payload.correlationId);
  return payload.data as T;
}
export function errorCopy(error: unknown) {
  if (error instanceof ProductError) {
    if (error.code === "AUTHENTICATION_REQUIRED") return "Your session has expired. Sign in again to continue.";
    if (error.code === "ACCESS_DENIED") return "Access is unavailable or has been revoked. Ask an organization administrator to check your membership.";
    if (error.code === "CONFIGURATION_UNAVAILABLE") return "This integration is not configured for this environment. An operator must complete setup before you can continue.";
    if (error.code === "INVALID_REQUEST") return "These details could not be accepted. Check the selected resources and try again.";
    return `The request could not be completed. Retry, or share reference ${error.correlationId ?? error.code} with support.`;
  }
  return "The workspace is unavailable. Check your connection and environment configuration, then retry.";
}
