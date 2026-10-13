# Findings and trust

Only the trusted control-plane evaluator can admit dynamic outcomes. Browser users can read within current organization/project membership and request a bounded replay; they cannot write attempts, assertions, finding states, bundles or regression results. A model claim has no finding-creation path.

Migrations 020/021 evolve Phase 4 observations/assertion results and add fixture templates/sets, logical identity/resource mappings, test cases/attempts, findings/occurrences/events, reproduction bundles, replay attempts and regression artifacts. All new tables force RLS. Current members may select tenant-scoped data; no browser DML policy or blanket service-role write grant is introduced. Composite organization/project parent keys reject cross-tenant links. Evidence, recipes, occurrences and events are append-only.

## Lifecycle

The first observed violation is CANDIDATE; an attempted repetition records REPRODUCING. These events are durably recorded together with admitted evidence, not streamed as live intermediate progress. Matching deterministic repetition produces REPRODUCED; uncertain repetition produces INCONCLUSIVE. Only reproduced failures generate a native regression artifact.

A replay request moves the finding to FIX_VERIFICATION. Exact-plan PASS with working controls produces RESOLVED. REPRODUCIBLE_FAILURE produces REGRESSION_FAILED; uncertain behavior produces INCONCLUSIVE. The active replay guards against an older replay overwriting a newer replay's state. Historical occurrences preserve every admitted result. FIX_PENDING and DISMISSED are reserved schema states; no unsupported browser transition is exposed.

An idempotent retry returns its existing run without reopening a completed finding or replacing a newer active replay. Recovery marks cancelled/dead-letter active replays INCONCLUSIVE. Superseded completion records its occurrence and a SUPERSEDED event without changing the current finding state.

The stable finding signature binds project, invariant ID/version, registered operation/case, resource type and normalized failed oracle. Fresh concrete IDs do not change it. Occurrences carry their run/attempt provenance. Replay uses the originating immutable plan hash and seed; it cannot silently replace the oracle to obtain a PASS.

## API

All paths are under `/api/v1/projects/:projectId` and use the existing verified principal and project authorization helpers:

| Method/path | Permission and result |
|---|---|
| GET `/runs/:runId/findings` | member; permitted finding occurrences |
| GET `/findings/:findingId` | member; permitted finding |
| POST `/findings/:findingId/replay` | OWNER/ADMIN; strict variant and requestKey only |
| GET `/findings/:findingId/reproduction-bundles` | member; run/attempt/digest metadata only |
| GET `/findings/:findingId/regressions` | member; native regression metadata |

Replay creates a new explicitly controlled lab deployment and scoped authorization, so its permission is OWNER/ADMIN. It accepts only fixed/vulnerable/inconclusive registered variants, never a target URL. No customer repository patch, fix PR, raw artifact download, Verified badge or polished finding UI is provided.

The worker gateway remains service-only. It rechecks current authority, signed-grant identity, attempt fencing and request accounting, then binds manifests to immutable run/deployment/authorization/invariant/plan identities. A compromised trusted control plane remains outside this local fixture trust model; these tests do not certify a production sandbox.
