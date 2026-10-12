# Durable orchestration (Phase 4)

`services/orchestrator/` is independent of Next request lifetimes. Its host composes an `ExecutionStore`, Ed25519 signing key, private `ArtifactStore`, and a `RunnerProvider`, then calls `Orchestrator.run(signal)`. `runnerHandler` is a separate internal service handler and is deliberately not mounted in the browser API. No loop starts during an API request. Production hosting/provider deployment is not configured by this change.

PostgreSQL is the queue/outbox. Run creation and a unique run job commit together. Organization row locks serialize authorization, membership changes, reservation, cancellation and execution commands. Jobs have READY/LEASED/CLEANUP/DONE/DEAD/CANCELLED states; runs have QUEUED/PREPARING/RUNNING/CANCELLING/CANCELLED/COMPLETED/FAILED_INFRASTRUCTURE. Lifecycle completion is not a verification PASS. Phase 4 results remain UNOBSERVABLE.

Claims create an attempt, monotonic fence, worker/runner identities, one-time grant JTI, reservation and ten-second lease atomically. Runner heartbeats occur every second; the control client has a two-second timeout. Grants expire within fifteen minutes, further bounded by authorization expiry. Every target request consumes durable budget and rechecks current authority/fencing. Crashed attempts first enter CLEANUP. A replacement cannot start until the provider confirms termination and cleanup. Cleanup itself has a thirty-second lease, can be reclaimed after restart, and must be idempotent. No capacity is released on an unconfirmed termination.

Attempts retry at most three times with 2^attempt seconds backoff. Exhausted jobs become DEAD and their runs FAILED_INFRASTRUCTURE after cleanup. Duplicate run keys return the same run only for the same input. Duplicate completion accepts only the same sealed digest. Lost fences, expired leases and cancellation reject new publication. No Redis/Kafka is used.

Reservations are organization-wide, so projects cannot bypass the shared ceiling. Defaults are 1000 requests per rolling 24-hour window and two concurrent slots. Authorization scopes additionally share a lifetime request ceiling and disallow overlapping attempts for that authorization. Attempt requests are counted before I/O; failed network calls still consume them. Unused reservations are released only after cleanup. The window resets only with no outstanding execution. Spend is zero; provider/AI/payment operations are unavailable. Durable rate enforcement is a conservative two requests/second without burst; local transport additionally has a maximum burst of five.

Cancellation records intent transactionally, blocks admission immediately and is recognized by the runner heartbeat. Recovery cancels queued jobs and terminates running attempts through the provider. A response already in flight may have reached the target; cancellation cannot undo it. Tests measure transport-abort recognition in a controlled blocked transport, not cloud termination latency. The production provider must demonstrate bounded termination independently.

Events correlate organization/project/run/attempt/worker and contain fixed event kinds and identifiers only. Browser commands also append the existing security audit with verified actor and correlation ID. Run events are append-only. Target bodies, credentials and exception payloads are never events.

API suffixes under `/api/v1/projects/:id`:

| Method | Path | Authority |
|---|---|---|
| POST | `/environments` | OWNER/ADMIN |
| POST | `/environments/:envId/deployments` | OWNER/ADMIN + provider ownership verification |
| POST | `/targets/authorize` | OWNER/ADMIN + current proof |
| POST | `/targets/:authorizationId/revoke` | OWNER/ADMIN |
| POST | `/vercel/revoke` | OWNER/ADMIN |
| POST | `/runs` | OWNER/ADMIN/DEVELOPER + current target authorization |
| POST | `/runs/:runId/cancel` | OWNER/ADMIN/DEVELOPER |
| GET | `/runs/:runId` | Current project member |
| GET | `/runs/:runId/events` | Current project member; bounded to 100 events |

Apply 018/019 after 001–017. Existing migrations are untouched. Supabase-hosted rehearsal and generated types are separate from the real local PostgreSQL/PostgREST suite. No production database is used by tests.
