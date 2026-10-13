# Webhook verification

The provider boundary supports SYNTHETIC, STRIPE and RAZORPAY families using local synthetic events. TEST and SYNTHETIC modes are safe fixture labels; neither contacts an external provider. LIVE is a safety stop regardless of host authorization. Unknown modes or states are rejected; unsafe mode and unknown policy produce INCONCLUSIVE without provider operations.

Normalized events bind provider, provider account, mode, event ID, logical user, order, payment, subscription, invoice and optional refund IDs, event kind, payment state, amount, currency, plan, logical version and time. Strict schemas and explicit metadata extraction prevent metadata from replacing trusted identity. Account/order/payment/subscription/invoice and catalog values must match before fixed-fixture mutation. The normalized version is a fixture ordering contract, not a claim that actual providers expose a universal monotonic version.

## Signatures and delivery

Stripe-like envelopes contain `data.object` payment details and a timestamped raw-body HMAC header; the fixture checks a bounded timestamp tolerance. Razorpay-like envelopes use `payload.payment.entity`, raw-body HMAC and an event identifier supplied separately. Both compare valid hexadecimal signatures in constant time. Tests cover missing, malformed, invalid, wrong-secret and modified-body signatures, known payment states, unknown state and live-mode rejection.

These are deliberately narrow fixture contracts, not complete provider payload/event-name emulators or SDK compatibility tests. Official references for the modeled primitives: [Stripe signature verification](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors) and [Razorpay webhook validation and testing](https://razorpay.com/docs/webhooks/validate-test/). **Stripe live E2E: UNVERIFIED. Razorpay live E2E: UNVERIFIED.** No credentials or network provider operations are required.

## Idempotency, replay and ordering

Delivery is at least once; the required guarantee is exactly one business effect for the same event. The inbox key is the tuple `(provider, providerAccount, mode, eventId)`. The fixed fixture uses SQLite `BEGIN IMMEDIATE`, unique inbox insertion, business-state update and COMMIT together; injected failure rolls back both inbox and entitlement. The vulnerable fixture checks before a barrier and updates outside that transaction, demonstrating two effects under simultaneous duplicate handlers. Repeated fixed races and rollback checks supplement sequential duplicate testing.

The deterministic two-party barrier overlaps handlers. This verifies local transactional behavior, not a distributed database or production multi-process deployment. Delayed replay advances time, closes/reopens the SQLite connection, processes an unrelated event and redelivers the original signed event. Connection reopen is not an OS-process restart test. Replay must not extend expiry or duplicate credits. Older capture events after cancellation, upgrade or refund cannot overwrite newer entitlement state.

Sealed traces retain bounded normalized event metadata, selected before/after state, business-effect counts, feature observations, logical time, counter totals and hashes. Raw webhook bodies, signatures and secrets are not retained. Fresh UUID mappings are scoped to each disposable attempt. Browser callers cannot author trusted traces or outcomes; existing control-plane admission, RLS and immutable bundle rules remain authoritative.
