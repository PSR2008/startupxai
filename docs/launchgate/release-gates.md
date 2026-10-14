# Exact release gates

Phase 8 wraps the Phase 1 deterministic assertion/reproduction evaluator. Models cannot supply outcomes, freshness, waivers or check conclusions. `services/releases/engine.ts` accepts trusted, manifest-verified evidence envelopes, recomputes outcomes and produces a coverage snapshot and decision.

A release identity binds organization, project, repository connection and snapshot, exact commit, immutable deployment/provider identity, environment, policy version and invariant-set digest. Requester/time and optional base/head/PR/branch context are retained. Branch names are context, never identity. Reference Lab identities explicitly use the harness provider and a content-derived synthetic revision; they never claim GitHub or Vercel verification.

Policies are append-only from creation, including requirements, families, journeys, regressions, blocking severities, permitted environments, exact runner/test/fixture/plan versions, freshness window and exception limits. Required coverage is 100%; required inconclusive behavior is non-approval. A version cannot be edited after use or before use. New versions require a new candidate binding.

## Decision semantics

- SHIP: the exact candidate satisfies every required applicable requirement or an explicit valid scoped exception, with no unwaived applicable blocking reproduced finding. At least one required applicable requirement must exist.
- BLOCK: a deterministic reproduced violation applies to the candidate and a blocking severity. Missing execution, broken controls and expired authorization do not independently create vulnerability findings.
- INCONCLUSIVE: required assurance is absent, stale, ambiguous or unreliable, or release identity does not match. It is not a confirmed vulnerability.

SHIP is not a claim that the application is globally secure. Optional requirements are kept separate from required counts. Optional reproduced failures can still block if their severity is blocking under policy.

Historical findings are reevaluated from sealed original evidence. Exact-scope unresolved findings apply. Carry-forward requires a persisted, complete dependency mapping and matching source digests in authenticated origin/head snapshots; ambiguous applicability prevents required approval. Resolved findings with fresh passing regressions do not block. Reintroduced reproduced regressions do. Critical resolved findings retain regression scheduling priority.

OWNER/ADMIN exceptions require a specific release, invariant and optional finding, reason, expiry, actor, role, time and optional ticket. An exception never changes a coverage item or finding to PASS. Finding-specific exceptions require the exact reproduced signature to waive that coverage failure. Revoked/expired/wrong-scope exceptions cannot apply. Creation, revocation and observed expiration are audited.

## Persistence and orchestration

Forward migrations 024–027 add policy versions/requirements, candidate identities, mutable state, run links, exceptions, dependencies, immutable evaluation/items, check publication history, release events, project configuration and private delivery/lease records. Existing migrations 001–023 are unchanged. All public release tables force tenant RLS and deny direct browser writes. Narrow user RPCs permit role-checked policy/exception/configuration/re-evaluation commands; the service RPC alone writes evaluation facts.

`ReleaseWorker` operates without browser requests. Signed events enter a deduplicated inbox. Configured projects queue exact source snapshots for the existing source worker. Candidates wait for a matching provider-verified deployment and completed snapshot. The worker then selects verification, schedules existing registered lab runs, waits for terminal runs, evaluates and publishes. Durable fenced leases recover interrupted ticks. Same-SHA publication is serialized, newer same-SHA candidate identities supersede older operational state, and historical evaluations remain immutable. A same-SHA re-evaluation starts with non-approving assurance status.

Release states are distinct from decisions: DISCOVERED, WAITING_FOR_DEPLOYMENT, READY, VERIFYING, EVALUATING, DECIDED, SUPERSEDED, CANCELLED. Discovery/waiting before deployment binding reside in the private event inbox; an exact candidate is created only when deployment identity exists. Selection reasons, estimated request cost, actual request count and duration are persisted. These are execution units, not prices.

The separately hosted entry point is `scripts/launchgate-release-worker.ts`, run with Node's `react-server` condition and `tsx` import after configuring the existing GitHub App and Supabase service credentials. It is not started by a web request. The existing provider integration must ingest a verified deployment; webhook URLs never establish ownership or become execution targets. Unavailable customer dynamic adapters yield explicit missing coverage/INCONCLUSIVE. This phase does not enable arbitrary customer repository execution or production browser navigation.

## API

Authenticated, project-authorized routes:

- GET `/api/v1/projects/:id/releases` and `/:releaseId`
- GET `/api/v1/projects/:id/releases/:releaseId/gate` (bounded evaluation history)
- POST `/api/v1/projects/:id/releases/:releaseId/re-evaluate` (DEVELOPER or above)
- GET/POST `/api/v1/projects/:id/policies` (creation requires OWNER/ADMIN)
- POST `/api/v1/projects/:id/policies/configure`
- POST `/api/v1/projects/:id/releases/:releaseId/exceptions` and `/revoke-exception`

Read responses are uncached. Requests cannot supply gate verdicts, candidate/provider facts, admission markers or check conclusions. Direct PostgREST access is additionally constrained by RLS and grants.

## Validation boundaries

Controlled HTTP fixtures and real local Chromium prove eight-domain release aggregation and scenarios A–F. PostgreSQL exercises durable scheduling, admission and tenant boundaries. Provider contract tests use synthetic credentials and responses. Live GitHub Checks, live Vercel deployment discovery, real customer dynamic verification and branch-protection enforcement are UNVERIFIED until explicitly configured and exercised. No fix PR, auto-merge, badge or UI redesign is included.
