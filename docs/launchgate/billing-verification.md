# Billing verification — Phase 6

Phase 6 extends the Phase 5 compiler, control-plane oracle, reproduction, findings, fixed replay and native regression artifacts. Phase 4 still owns scheduling, signed grants, request accounting, cancellation and evidence admission. Only disposable, local Reference Lab fixtures execute; no customer payment systems or production StartupX routes are invoked.

## Registered programs and outcomes

The 27 versioned cases in `reference-lab/billing/contracts.ts` cover client price/plan/currency manipulation, captured success, failed/created/pending/authorized payments, five invalid signature forms, duplicates, delayed replay, concurrent delivery, stale events after cancellation/upgrade/refund, cancellation, expiry, upgrades, downgrades, refunds, client-only activation, wrong accounts and amount mismatch. They compile to fixed operations in `billing_entitlements` or `webhook_integrity`; arbitrary operation scripts are not accepted.

Every attempt first observes an unpaid control account, creates its authoritative order, delivers a valid captured payment and verifies both persisted entitlement and an actual paid export. The control plane must accept this positive control before the adversarial sequence. The collector records facts, never a verdict. The deterministic oracle compares the confirmed policy, order, payment/subscription state, plan, credits, business-effect count, entitlement end, actual feature access and a stable second read. An observed mutation followed by HTTP 500 still fails; timeout, unknown provider state, unavailable observations, failed controls or uncertain cleanup cannot pass.

A blocking finding requires matching fresh-state reproduction. Each fixture has fresh account/payment/order/subscription/invoice/event identifiers while preserving the seed, logical initial-state hash and original plan. Fixed replay uses the original oracle and positive controls. A fix that disables legitimate payment activation remains INCONCLUSIVE. Native expected-PASS regression recipes pass the fixed fixture and fail a reintroduced vulnerability. Finding signatures include provider, mode and policy scope.

## Runtime and budgets

`fixture.ts` runs real HTTP on an ephemeral loopback port with a per-instance scope key. It owns a private temporary SQLite database, WAL, deterministic clock and ephemeral HMAC secret. Source identity hashes the actual fixture and runner source bytes, including all billing modules. The legacy `commit_sha` field is a content revision, not a Git commit; no image digest is invented.

Original execution plus reproduction share 64 HTTP requests, 120 seconds, 16 event deliveries, 20 provider operations, 64 KiB evidence and zero financial spend. Concurrency is one except the registered two-delivery barrier case. The durable runner charges requests before transport and uses the existing two requests/second ceiling. Fast application tests inject pacing; database journeys use actual pacing and accounting. Delivery counters count initiated attempts even if a timeout makes completion unknown. There are no billing-period wall-clock sleeps.

Cleanup closes connections and deletes only the verified fixture-specific temporary directory. Cleanup failures remain visible and prevent PASS. Migration 022 extends fixture families, reserved-host operation capabilities and billing lab budgets; it adds no customer billing tables and changes no historical migration. Existing forced RLS, immutable artifacts and service-only admission apply to billing observations and findings.

## Local verification

Run `npm run test:billing-lab` for all billing application tests. Focused commands: `test:price-integrity`, `test:failed-payment`, `test:capture-state`, `test:webhook-signature`, `test:webhook-replay`, `test:billing-concurrency`, `test:cancellation-expiry`, `test:upgrade-downgrade`, `test:refund-policy`, `test:billing-fix-replay`, `test:billing-regression`, `test:startupx-dogfood`, `test:billing-provider`.

Set `LAUNCHGATE_REQUIRE_DATABASE=1` and run `npm run test:phase6-journeys` with Docker available. This executes the complete disposable PostgreSQL/PostgREST rehearsal, including seven billing journeys: failed payment, duplicate event, price manipulation, authorized-but-uncaptured payment, cancellation, expiry and concurrent delivery. Fifteen billing runs persist findings, fixed replays and a reintroduced regression; no external database connection is accepted. See the [acceptance ledger](v1-acceptance.md) for exact counts.

## StartupX dogfood and limits

Read-only inspection found three patterns represented in isolated Razorpay-like fixtures: activation without checking captured state, replay refreshing entitlement expiry, and payment/entitlement writes without one atomic business transaction. The three dogfood tests reproduce equivalent synthetic behavior and verify fixed variants. They do not invoke or modify `src/lib/payment-activation.ts` or the production Razorpay verification route, and do not claim those production defects are repaired.

No provider SDK/network calls, live cards, real money, customer code, browser journey engine, generated fixes/PRs, commercial billing replacement or Verified badge are part of this phase. Provider results are synthetic contracts, not live integration certification. See [webhook contracts](webhook-verification.md) and [entitlement policy](entitlement-model.md).
