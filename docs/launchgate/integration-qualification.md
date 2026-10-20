# Integration qualification

No dedicated staging assets or approved live budget are available. The user
requested local readiness testing only. Existing StartupX `.env.local` credentials
are not authorization to operate on production. No live provider calls were made.

| Capability | Status | Required dedicated setup and evidence |
| --- | --- | --- |
| GitHub live | UNVERIFIED | User-owned test repo; install the read App only there; configure existing LAUNCHGATE_GITHUB_* server secrets; signed webhook delivery to staging; prove numeric repo access, exact SHA ingestion, dedupe and check publication. Separately install the remediation App and obtain explicit test PR consent before branch/PR writes. Revoke installation/capability and prove denial. |
| Vercel live | UNVERIFIED | Dedicated staging team/project and immutable preview; scoped connection token in secret backend; verify project owner, repo/SHA binding, deployment discovery and nonproduction target; short-lived bypass credential in header only; redirect stripping/denial and revocation. |
| Supabase hosted | UNVERIFIED | New disposable staging project, isolated keys and migration runner. Apply 001 onward from clean state and rehearse upgrade from 031; generate database types with the approved project-specific CLI; run actual auth/session, RLS and service-role isolation tests. Never reset the existing project. |
| Stripe test | UNVERIFIED | Separate test-mode key and test webhook endpoint; test payment success/failure, signed duplicate deliveries, cancellation/refund where supported; verify no live-mode object or key. |
| Razorpay test | UNVERIFIED | Dedicated rzp_test key and test webhook secret; exact order amount/currency and signature checks, captured-state behavior supported by test API, replay dedupe; never rzp_live. |
| OpenAI live | UNVERIFIED | Dedicated test project/key, explicitly approved model and hard diagnostic budget; one tiny request through quota reservation with bounded output, timeout, redaction and measured usage. No benchmark. |
| Anthropic live | UNVERIFIED | Dedicated test key, approved model and budget; same bounded diagnostic and accounting evidence. Existing StartupX key is not used. |
| Production sandbox | BLOCKED_BY_ENVIRONMENT | Selected account/backend, reviewed isolation adapter, enforced egress, provider limits and full hostile-boundary qualification. |
| Managed secrets | UNVERIFIED | Environment-specific managed store, restricted workload identity, revocation/rotation audit and lease TTL enforcement. |
| Private artifacts | UNVERIFIED | Separate private encrypted bucket/container, scoped credentials, object hash/retention, signed URL expiry and cross-tenant denial tests. |
| Controlled staging E2E | UNVERIFIED | Dedicated repo -> preview -> authorized sandbox -> evidence -> gate -> explicit test PR -> exact replay -> VERIFIED/SHIP. Every link must be exercised. |

Configuration is not verification. The capability registry accepts evidence only
from the trusted service RPC; browser roles cannot write it. VERIFIED requires
live evidence digest and a bounded validity interval. Stale/synthetic evidence
cannot produce production readiness. DEGRADED and revoked/unverified records
supersede earlier good observations. No local test populates a live VERIFIED record.

Live qualification belongs in an approved staging workflow with environment
protection and short-lived secrets, not general PR CI. No live workflow capable
of mutating unknown assets is enabled in this phase. `launchgate-readiness.ts`
prints safe local readiness states and performs no network probes.

## GitHub staging setup checklist

1. Create a dedicated test repository owned by the user; record its numeric ID,
   organization and staging project. Do not substitute another repository.
2. Register a separate staging analysis App with Metadata/Contents read and the
   already-supported Checks write permission; install only on that repository.
3. Store `LAUNCHGATE_GITHUB_APP_ID`, `LAUNCHGATE_GITHUB_CLIENT_ID`,
   `LAUNCHGATE_GITHUB_CLIENT_SECRET`, `LAUNCHGATE_GITHUB_PRIVATE_KEY`,
   `LAUNCHGATE_GITHUB_WEBHOOK_SECRET` and `LAUNCHGATE_GITHUB_REDIRECT_URI` only in
   the staging control-plane secret environment. Use a valid RSA App private key
   and staging HTTPS callback/webhook endpoints; never browser-visible variables.
4. Exercise connection, source snapshot, webhook verification/dedupe and Checks
   against the recorded repository/SHA; retain redacted evidence and cleanup IDs.
5. Optional PR qualification needs a different App with Contents/Pull requests
   write on that test repository, `LAUNCHGATE_REMEDIATION_APP_ID` and
   `LAUNCHGATE_REMEDIATION_PRIVATE_KEY`, capability activation, and explicit test
   PR permission. The current customer source/preview workflow still needs its
   provider adapter; installing an App does not make that workflow operational.
6. Revoke the staging installation/capability, confirm access denial, and remove
   only the recorded test branch/PR/resources where explicitly authorized.

All other setup rows above similarly require named dedicated assets before
credentials are loaded. Local readiness does not discover or reuse unrelated
accounts, and no general CI workflow accepts permanent production credentials.

## Phase 13 qualification framework

`services/production/qualification.ts` defines 20 required evidence checklists. Synthetic/contract observations cannot become VERIFIED. Missing assets block without provider calls; optional absent remediation remains UNVERIFIED. Approved assets without a registered driver are NOT_IMPLEMENTED. Failed cleanup prevents verification.

Migration 037 extends the trusted, append-only registry with configuration/runtime digests and safe reason codes. Browser roles cannot write qualifications or reserve diagnostic budgets. The previous RPC is no longer service-callable. Local reports are persisted separately when hosted persistence is unavailable. See [staging setup](staging.md) and [actual live matrix](live-qualification-matrix.md); no provider was live-qualified in this phase.
