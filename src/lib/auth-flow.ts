export const DEFAULT_AUTH_DESTINATION = "/dashboard";
export const OAUTH_NEXT_COOKIE = "startupx_oauth_next";
export const GOOGLE_AUTH_ERROR_MESSAGE =
  "Google sign-in could not be completed. Please try again.";

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
  if (decoded === "/") return DEFAULT_AUTH_DESTINATION;
  if (
    decoded.startsWith("/auth/callback") ||
    decoded.startsWith("/signin") ||
    decoded.startsWith("/signup") ||
    decoded.startsWith("/login")
  ) {
    return DEFAULT_AUTH_DESTINATION;
  }
  return decoded;
}

export function buildGoogleOAuthRedirectTo(origin: string): string {
  const safeOrigin = origin.replace(/\/+$/, "");
  const callbackUrl = new URL("/auth/callback", safeOrigin);
  return callbackUrl.toString();
}

export function getAuthorizationRedirectTo(authorizationUrl: string): string | null {
  try {
    const url = new URL(authorizationUrl);
    return url.searchParams.get("redirect_to") ?? url.searchParams.get("redirectTo");
  } catch {
    return null;
  }
}

export function isExpectedGoogleAuthorizationUrl(authorizationUrl: string, expectedCallbackUrl: string): boolean {
  try {
    const url = new URL(authorizationUrl);
    const redirectTo = getAuthorizationRedirectTo(authorizationUrl);
    return (
      url.searchParams.get("provider") === "google" &&
      redirectTo === expectedCallbackUrl &&
      url.searchParams.has("code_challenge") &&
      url.searchParams.has("code_challenge_method")
    );
  } catch {
    return false;
  }
}

export function authFailureRedirect(origin: string): URL {
  const url = new URL("/signin", origin);
  url.searchParams.set("reason", "google-error");
  return url;
}
