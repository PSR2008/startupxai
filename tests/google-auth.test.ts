import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_AUTH_DESTINATION,
  buildGoogleOAuthRedirectTo,
  authFailureRedirect,
  getAuthorizationRedirectTo,
  isExpectedGoogleAuthorizationUrl,
  normalizeAuthNextPath,
} from "../src/lib/auth-flow";

test("valid internal next path is preserved for OAuth", () => {
  assert.equal(normalizeAuthNextPath("/evidence-engine"), "/evidence-engine");
  assert.equal(normalizeAuthNextPath("/dashboard"), "/dashboard");
  assert.equal(normalizeAuthNextPath("/reports/abc?tab=summary"), "/reports/abc?tab=summary");
});

test("external and protocol-relative next URLs are rejected", () => {
  assert.equal(normalizeAuthNextPath("https://evil.example/path"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("//evil.example/path"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("http:%2f%2fevil.example/path"), DEFAULT_AUTH_DESTINATION);
});

test("missing, home, and auth-route next paths fall back to the authenticated dashboard", () => {
  assert.equal(normalizeAuthNextPath(null), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("/"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("/auth/callback?code=x"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("/signin?next=/evidence-engine"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("/signup"), DEFAULT_AUTH_DESTINATION);
  assert.equal(normalizeAuthNextPath("/login"), DEFAULT_AUTH_DESTINATION);
});

test("Google OAuth redirect uses internal callback and encoded next path", () => {
  const redirectTo = buildGoogleOAuthRedirectTo("https://startupxai.in/", "/evidence-engine");
  assert.equal(redirectTo, "https://startupxai.in/auth/callback?next=%2Fevidence-engine");
  assert.equal(
    buildGoogleOAuthRedirectTo("https://startupxai.in/", "/"),
    "https://startupxai.in/auth/callback?next=%2Fdashboard"
  );
  assert.doesNotMatch(redirectTo, /https:\/\/startupxai\.in\/(?:\?|$)/);
});

test("Supabase authorization URL redirect_to is inspected before browser navigation", () => {
  const callback = buildGoogleOAuthRedirectTo("https://startupxai.in", "/evidence-engine");
  const authorizationUrl =
    "https://example.supabase.co/auth/v1/authorize" +
    `?provider=google&redirect_to=${encodeURIComponent(callback)}` +
    "&code_challenge=challenge&code_challenge_method=s256&skip_http_redirect=true";
  assert.equal(getAuthorizationRedirectTo(authorizationUrl), callback);
  assert.equal(isExpectedGoogleAuthorizationUrl(authorizationUrl, callback), true);
  assert.equal(
    isExpectedGoogleAuthorizationUrl(
      "https://example.supabase.co/auth/v1/authorize?provider=google&code_challenge=challenge&code_challenge_method=s256",
      callback
    ),
    false
  );
  assert.equal(
    isExpectedGoogleAuthorizationUrl(
      "https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fstartupxai.in%2F&code_challenge=challenge&code_challenge_method=s256",
      callback
    ),
    false
  );
});

test("failure redirect is safe and hides provider internals", () => {
  const redirect = authFailureRedirect("https://startupxai.in");
  assert.equal(redirect.toString(), "https://startupxai.in/signin?reason=google-error");
});

test("Google auth button initiates Supabase OAuth with Google provider and callback", () => {
  const source = readFileSync(join(process.cwd(), "src/components/auth/GoogleAuthButton.tsx"), "utf8");
  assert.match(source, /signInWithOAuth/);
  assert.match(source, /provider:\s*"google"/);
  assert.match(source, /buildGoogleOAuthRedirectTo/);
  assert.match(source, /Continue with Google/);
  assert.match(source, /redirectTo/);
  assert.match(source, /skipBrowserRedirect:\s*true/);
  assert.match(source, /isExpectedGoogleAuthorizationUrl\(data\.url, redirectTo\)/);
  assert.match(source, /window\.location\.assign\(data\.url\)/);
  assert.doesNotMatch(source, /drive|gmail|calendar/i);
  assert.doesNotMatch(source, /scopes:/);
});

test("there is only one active Google OAuth initiation path", () => {
  const button = readFileSync(join(process.cwd(), "src/components/auth/GoogleAuthButton.tsx"), "utf8");
  const signin = readFileSync(join(process.cwd(), "src/app/(auth)/signin/page.tsx"), "utf8");
  const signup = readFileSync(join(process.cwd(), "src/app/(auth)/signup/page.tsx"), "utf8");
  const repoMatches = [button, signin, signup].join("\n").match(/signInWithOAuth/g) ?? [];
  assert.equal(repoMatches.length, 1);
  assert.match(signin, /<GoogleAuthButton nextPath=\{nextPath\} \/>/);
  assert.match(signup, /<GoogleAuthButton nextPath=\{googleNextPath\} \/>/);
});

test("OAuth request does not fall back to the Supabase Site URL", () => {
  const callback = buildGoogleOAuthRedirectTo("https://startupxai.in", null);
  const siteUrlAuthorization =
    "https://example.supabase.co/auth/v1/authorize" +
    "?provider=google&redirect_to=https%3A%2F%2Fstartupxai.in%2F" +
    "&code_challenge=challenge&code_challenge_method=s256";
  assert.equal(callback, "https://startupxai.in/auth/callback?next=%2Fdashboard");
  assert.equal(isExpectedGoogleAuthorizationUrl(siteUrlAuthorization, callback), false);
});

test("canonical browser Supabase client uses SSR PKCE and does not process URL fragments", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/supabase-client.ts"), "utf8");
  assert.match(source, /createBrowserClient/);
  assert.match(source, /@supabase\/ssr/);
  assert.match(source, /flowType:\s*"pkce"/);
  assert.match(source, /detectSessionInUrl:\s*false/);
  assert.match(source, /persistSession:\s*true/);
  assert.match(source, /autoRefreshToken:\s*true/);
  assert.doesNotMatch(source, /createClient\(url,\s*key/);
});

test("Google authorization is configured for PKCE callback instead of implicit homepage flow", () => {
  const client = readFileSync(join(process.cwd(), "src/lib/supabase-client.ts"), "utf8");
  const button = readFileSync(join(process.cwd(), "src/components/auth/GoogleAuthButton.tsx"), "utf8");
  const flow = readFileSync(join(process.cwd(), "src/lib/auth-flow.ts"), "utf8");
  assert.match(client, /flowType:\s*"pkce"/);
  assert.match(flow, /new URL\("\/auth\/callback", safeOrigin\)/);
  assert.match(flow, /searchParams\.set\("next", safeNext\)/);
  assert.match(flow, /searchParams\.get\("redirect_to"\)/);
  assert.match(flow, /searchParams\.has\("code_challenge"\)/);
  assert.match(button, /buildGoogleOAuthRedirectTo\(window\.location\.origin, safeNext\)/);
  assert.doesNotMatch(button, /window\.location\.href\s*=\s*["'`]\/["'`]/);
});

test("sign-in and sign-up preserve email password authentication", () => {
  const signin = readFileSync(join(process.cwd(), "src/app/(auth)/signin/page.tsx"), "utf8");
  const signup = readFileSync(join(process.cwd(), "src/app/(auth)/signup/page.tsx"), "utf8");
  assert.match(signin, /signInWithPassword/);
  assert.match(signup, /signUp/);
  assert.match(signin, /or continue with email/);
  assert.match(signup, /or continue with email/);
});

test("callback exchanges the code, validates next, and redirects safely", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /exchangeCodeForSession\(code\)/);
  assert.match(route, /normalizeAuthNextPath/);
  assert.match(route, /NextResponse\.redirect\(new URL\(nextPath, requestUrl\.origin\)\)/);
  assert.match(route, /authFailureRedirect/);
});

test("successful callback attaches Supabase session cookies to the redirect response", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /responseCookies\.push\(\.\.\.cookiesToSet\)/);
  assert.match(route, /response\.cookies\.set\(name, value, options\)/);
  assert.match(route, /return response/);
});

test("Google signup without a requested next path uses login default, while email signup can keep onboarding", () => {
  const signup = readFileSync(join(process.cwd(), "src/app/(auth)/signup/page.tsx"), "utf8");
  assert.match(signup, /googleNextPath/);
  assert.match(signup, /setGoogleNextPath\(normalizeAuthNextPath\(requestedNext\)\)/);
  assert.match(signup, /setNextPath\(normalizeAuthNextPath\(requestedNext \|\| "\/onboarding"\)\)/);
});

test("callback handles missing code and exchange failures without exposing tokens", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /if \(!code\)/);
  assert.match(route, /exchange_failed/);
  assert.doesNotMatch(route, /access_token|refresh_token|searchParams\.toString\(\)|location\.hash/);
  assert.doesNotMatch(route, /properties:\s*\{[^}]*code\s*:/);
  assert.doesNotMatch(route, /properties:\s*\{[^}]*requestUrl/);
});

test("OAuth bootstrap creates only a default user role and no paid/internal entitlement", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /user_roles/);
  assert.match(route, /role:\s*"user"/);
  assert.match(route, /ignoreDuplicates:\s*true/);
  assert.doesNotMatch(route, /user_plans|payments|role:\s*"internal"|role:\s*"admin"/);
});

test("authentication analytics do not include authorization codes or callback URLs", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /google_auth_completed/);
  assert.match(route, /google_auth_failed/);
  assert.doesNotMatch(route, /code.*properties|req\.url.*properties|requestUrl\.href/);
});

test("fragment token guard removes implicit tokens without creating a session", () => {
  const guard = readFileSync(join(process.cwd(), "src/components/auth/AuthFragmentGuard.tsx"), "utf8");
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  assert.match(guard, /window\.location\.hash/);
  assert.match(guard, /access_token/);
  assert.match(guard, /refresh_token/);
  assert.match(guard, /history\.replaceState/);
  assert.match(guard, /\/signin\?reason=google-error/);
  assert.doesNotMatch(guard, /setSession|exchangeCodeForSession|getSupabaseBrowserClient/);
  assert.match(layout, /<AuthFragmentGuard \/>/);
});

test("protected-page return flow points sign-in next toward the requested app route", () => {
  const gate = readFileSync(join(process.cwd(), "src/components/app/AuthGate.tsx"), "utf8");
  assert.match(gate, /signin\?next=/);
  assert.match(gate, /encodeURIComponent\(pathname\)/);
});
