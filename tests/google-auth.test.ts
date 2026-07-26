import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildGoogleOAuthRedirectTo, authFailureRedirect, normalizeAuthNextPath } from "../src/lib/auth-flow";

test("valid internal next path is preserved for OAuth", () => {
  assert.equal(normalizeAuthNextPath("/evidence-engine"), "/evidence-engine");
  assert.equal(normalizeAuthNextPath("/reports/abc?tab=summary"), "/reports/abc?tab=summary");
});

test("external and protocol-relative next URLs are rejected", () => {
  assert.equal(normalizeAuthNextPath("https://evil.example/path"), "/dashboard");
  assert.equal(normalizeAuthNextPath("//evil.example/path"), "/dashboard");
  assert.equal(normalizeAuthNextPath("http:%2f%2fevil.example/path"), "/dashboard");
  assert.equal(normalizeAuthNextPath("/auth/callback?code=x"), "/dashboard");
});

test("Google OAuth redirect uses internal callback and encoded next path", () => {
  const redirectTo = buildGoogleOAuthRedirectTo("https://startupxai.in/", "/evidence-engine");
  assert.equal(redirectTo, "https://startupxai.in/auth/callback?next=%2Fevidence-engine");
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
  assert.match(source, /openid email profile/);
  assert.doesNotMatch(source, /drive|gmail|calendar/i);
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

test("callback handles missing code and exchange failures without exposing tokens", () => {
  const route = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
  assert.match(route, /if \(!code\)/);
  assert.match(route, /exchange_failed/);
  assert.doesNotMatch(route, /access_token|refresh_token|searchParams\.toString\(\)/);
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

test("protected-page return flow points sign-in next toward the requested app route", () => {
  const gate = readFileSync(join(process.cwd(), "src/components/app/AuthGate.tsx"), "utf8");
  assert.match(gate, /signin\?next=/);
  assert.match(gate, /encodeURIComponent\(pathname\)/);
});
