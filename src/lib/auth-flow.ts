export const DEFAULT_AUTH_DESTINATION = "/dashboard";
export const GOOGLE_AUTH_ERROR_MESSAGE =
  "Google sign-in could not be completed. Please try again or continue with email.";

export function normalizeAuthNextPath(value?: string | null): string {
  if (!value) return DEFAULT_AUTH_DESTINATION;
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = value.trim();
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return DEFAULT_AUTH_DESTINATION;
  if (decoded.includes("\\") || decoded.includes("\n") || decoded.includes("\r")) return DEFAULT_AUTH_DESTINATION;
  if (decoded.startsWith("/auth/callback") || decoded.startsWith("/signin") || decoded.startsWith("/login")) return DEFAULT_AUTH_DESTINATION;
  return decoded;
}

export function buildGoogleOAuthRedirectTo(origin: string, nextPath?: string | null): string {
  const safeOrigin = origin.replace(/\/+$/, "");
  const safeNext = normalizeAuthNextPath(nextPath);
  return `${safeOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

export function authFailureRedirect(origin: string): URL {
  const url = new URL("/signin", origin);
  url.searchParams.set("reason", "google-error");
  return url;
}
