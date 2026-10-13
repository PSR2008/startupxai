# Entitlement model

Phase 6 uses an explicitly confirmed, version-one Reference Lab policy. It never infers customer refund, cancellation, credit or downgrade policy. UNKNOWN policy returns INCONCLUSIVE / REQUIRES_CONFIRMATION before HTTP/provider operations. The registered operator confirmation applies only to this synthetic catalog.

| Policy | Supported reference behavior |
|---|---|
| Catalog | BASIC: 1000 USD minor units / 100 credits; PRO: 2500 / 250 credits |
| Activation | CAPTURED payment only; created, pending, authorized and failed cannot grant access |
| Price/currency | Server catalog and order are authoritative; client assertions cannot change them |
| Period | 100 logical clock units; zero grace, no trial |
| Cancellation | Confirmed IMMEDIATE revocation or PERIOD_END scheduling |
| Upgrade | Immediate PRO entitlement and replacement credit allowance |
| Downgrade | Confirmed IMMEDIATE or NEXT_PERIOD BASIC entitlement |
| Refund | Confirmed REVOKE or MANUAL_REVIEW; review preserves paid access explicitly |
| Credits | Replace on plan change; duplicate events never add allowance |

An order, a provider event, a payment and an entitlement are separate facts. A successful webhook response or signature alone cannot prove payment capture. Selected state includes plan, payment/subscription status, start/end, source, credits, business-effect count, semantic version, scheduled cancellation and pending plan. The verifier reads actual protected export access as well as selected persisted state; neither a database plan label nor an HTTP code alone decides success.

The deterministic clock starts at 1000. Expiry and period-end schedules are observed at 1099 and 1100, followed by a stable post-boundary observation at 1101. Next-period downgrade observes PRO before and BASIC at the boundary. Replay cannot manufacture a new period from the same payment. Cancellation, upgrade and refund ordering programs reject stale capture overwrites.

Partial refunds, proration, positive grace periods, trials, arbitrary catalog prices, provider-specific subscription reconciliation and real charge settlement are unsupported. Policy schema rejection or unknown observations must not be described as successful verification. The model is a bounded test fixture, not LaunchGate commercial billing or a replacement for StartupX payment logic.
