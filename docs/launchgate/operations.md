# Operations

Migration 032 adds forced-RLS resource metadata, append-only qualification and
safe operational event history. It changes no earlier migration. Only the
trusted operations RPC can mutate these records; OWNER/ADMIN may read their org.
The database contains references/digests, not secret bytes or provider responses.

Structured event contracts cover queue delay, run creation, sandbox lifecycle,
leaks, target requests, budget denial, credential lease/revoke, evidence/artifact
ingestion, retries, provider/database errors, cleanup and dead letters. Observer
schemas reject arbitrary messages, URLs, headers and secret payloads. Provider
hosts must route these to their metrics sink; no hosted telemetry was deployed.

Retries classify timeout/network/5xx/rate-limit as transient; credential,
revocation, target, policy and malformed requests are terminal. Maximum three
attempts, capped retry-after/backoff, circuit opens after three failures for
30 seconds. Only reads or provider-guaranteed idempotent operations retry. Never
retry an unkeyed business side effect. Errors returned from the boundary use fixed
codes rather than raw provider bodies.

GitHub outage cannot refresh source/evidence; Vercel outage leaves verification
waiting/inconclusive. Sandbox outage cannot generate PASS. Artifact upload failure
must prevent evidence finalization. Existing Phase 4 evidence ingestion and
Phase 8/9 gates remain authoritative; operational readiness cannot resolve findings.
Sandbox, credential-delivery and artifact-upload failures also append DEGRADED
capability records. The production host reloads trusted qualifications before
dispatch/delivery; a new live qualification is required to restore VERIFIED.
`qualificationReader` checks tenant/environment when mapping persisted records.

Resource intent precedes sandbox provisioning. Reaper claims expired resources
with durable worker/fence/lease, retries idempotent cleanup after restart, and
records failure without declaring destruction. Five failures enter DEAD_LETTER
for operator investigation. Never clear the record until exact-owned destruction
is confirmed. Reaper invokes existing execution recovery for dead jobs and budget
reservations; existing orchestrator termination confirmation releases capacity.

Cloud adapter deployment must run supervisor and reaper continuously with alerts
for expired live resources, stale heartbeats, dead letters and cleanup failures.
Hard provider deadlines and storage/secret TTLs must remain effective without the
control plane. No cloud resource inventory endpoint is implemented without a
selected provider; provider-side orphan reconciliation remains unqualified.
