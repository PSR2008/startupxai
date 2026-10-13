# Quota, concurrency and rate verification

Quota response is not proof. The verifier observes reservation, provider invocation, committed usage and synthetic cost in addition to HTTP status. Five admitted operations consume five units; a sixth must not invoke the provider or increase usage. The vulnerable fixture deliberately invokes the provider before the post-work usage check and may return 429 despite consuming provider work.

## Transaction boundaries

Fixed admission takes SQLite `BEGIN IMMEDIATE`, reads shared usage/budget/rate state, validates identity/model/input and capacity, records a reservation, and commits before provider invocation. Reconciliation commits reservation release and actual usage/cost together. The provider's sequence record must show a positive reservation sequence earlier than invocation. Private temporary SQLite databases use WAL and two connections representing logical instances A/B.

The registered ten-client barrier schedule starts with four used units and one remaining. Fixed behavior admits exactly one more provider call and denies nine. Vulnerable handlers meet after a stale read and before provider work, making the overspend repeatable. Organization concurrency alternates two identities and both instance connections against the same aggregate ceiling. Repeated fixed races supplement fresh-state reproduction.

These are deterministic local logical-instance tests, not a production distributed database or process-crash durability certification. They do not prove provider idempotency, retries or distributed clock synchronization. Customer code is never executed.

## Rate semantics

The supported confirmed algorithm is FIXED_WINDOW. Policy declares limit, ten-unit window and optional explicit burst. Programs cover within-limit, boundary, over-limit, burst, concurrency and reset immediately before/at the boundary. No universal rate algorithm is assumed; token-bucket semantics are unsupported in this version.

The distributed vulnerable fixture keeps independent A/B limiter keys. Alternating instances admits more work than the declared global policy. The fixed version reads one durable shared key across both connections. Quota/budget counters and provider records distinguish a genuinely enforced limit from a misleading response code.

The deterministic clock starts at 1000. Rate reset probes 1009 then 1010; quota reset probes 1099 then 1100. There are no billing-period or quota-period wall-clock sleeps. Confirmed rollover is NONE. Failure policy chooses no charge or the reserved maximum; provider errors without reliable observation remain inconclusive.

Cleanup closes servers and both SQLite connections and removes only the verified fixture-specific temporary path. Cancellation, observation failure, timeout, positive-control failure and cleanup uncertainty have explicit tests. Existing control-plane admission, sealed artifacts, forced RLS and browser write denial protect these observations.

Run `npm run test:ai-lab`. Focused commands include `test:anonymous-access`, `test:model-boundary`, `test:quota-boundary`, `test:concurrent-quota`, `test:distributed-rate-limit`, `test:cost-ceiling`, `test:provider-failure-accounting`, `test:phase7-fix-replay`, `test:phase7-regression` and `test:startupx-ai-dogfood`. Some aliases intentionally share suites; do not add their counts to the full test total.
