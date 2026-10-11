# Integration state and configuration

This guide replaces outdated instructions that described client usage pings as authoritative and usage as tracking-only. The running StartupX application enforces server-side entitlements; `/api/usage-log` is a deprecated no-op. Its usage reservation ordering/fallback still has the risks identified in Phase 0.

## Existing integrations

| Feature | Configuration | What remains unverified locally |
| --- | --- | --- |
| Supabase auth | Public project URL/key | OAuth redirects, email templates/recovery, live sessions |
| Supabase persistence | Project URL + service role key | Deployed migrations, grants/RLS, real writes |
| Anthropic analysis | API key; optional ANTHROPIC_MODEL | Provider authorization, response/cost behavior |
| Razorpay checkout | Key ID/secret + webhook secret | Capture settings, signed events, payment lifecycle |
| IP hashing | Unique >=32-character salt | Deployment secret management; old fallback is not repaired here |

A placeholder configuration is expected on this machine. Missing/placeholder/malformed values are configuration problems, not justification to rewrite providers. Never insert fake credentials to make a build pass. Unit tests and CI need no provider credentials. Supabase server factories return unavailable for invalid configuration; valid configurations retain their existing client options.

## Authentication boundary

`src/server/auth/principal.ts` resolves a bearer token using Supabase `getUser`, never a request user ID or a browser-session claim. It returns a frozen identity with verified origin. The injectable verifier is a trusted server/test dependency and must never be selected by a request. `usage-limit.ts` delegates only identity resolution; existing entitlement and billing behavior is preserved. No organization membership or role authorization is invented.

## Health

Liveness returns HTTP 200 when the handler runs. Configuration readiness is a separate aggregate, not a connectivity probe. Detailed state inspection is server-only. The public response does not disclose provider key presence. The old diagnostic UI will show no provider checklist until an authorized diagnostics surface is designed.

## Future LaunchGate integrations

GitHub App/OAuth, Vercel preview binding, Stripe, isolated runners, artifact storage, durable jobs, signed evidence ingestion and LaunchGate billing are **not implemented**. No new integration credentials are required in Phase 1. See `docs/launchgate/architecture.md` for the intended trust boundaries.

## Database and existing customers

Historical migrations remain unchanged. Inspect the actual database before future migrations; old README SQL could leave different types/policies. Confirm existing customer/payment/data obligations before destructive work. Old evidence cannot become LaunchGate verification evidence.
