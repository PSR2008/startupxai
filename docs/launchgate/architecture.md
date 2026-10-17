# LaunchGate architecture — Phase 1

Status: Phase 3 adds read-only GitHub integration, bounded immutable source ingestion, deterministic architecture observations and versioned invariant review alongside the Phase 1/2 foundations. StartupX remains the running product. No dynamic target testing, customer-code runner, artifact service or attestation is implemented. [Tenancy](tenancy.md), [GitHub integration](github-integration.md), [source ingestion](source-ingestion.md) and [invariant discovery](invariant-discovery.md) describe the implemented boundaries and limitations.

Phase 2 implements eight prefixed public-schema tables, six narrow authenticated database commands, centralized server authorization and versioned APIs. It uses caller-token RLS for reads and atomically authorized/audited commands for writes; routine LaunchGate APIs never use the service role. Project access currently inherits organization membership. SQL/HTTP integration tests use disposable PostgreSQL/PostgREST, with no production credentials. Future lists below remain design direction, not implemented persistence.

Phase 3 adds nine public metadata tables and one private hashed setup-state table through migrations 016/017. Source bytes stay in memory; graph/integration signals and proposal evidence are bounded JSON tied to immutable snapshot parents. Provider-verified writes use one explicitly privileged command gateway, with no broad new service-role table grants. User requests/reviews use caller-token authorization. GitHub credentials are never passed to the parser worker. Snapshot state also provides the minimal queue/lease/fencing metadata; automatic scheduling remains a Phase 4 concern.

The source parser package has no repository filesystem, subprocess, module-resolution or network APIs. GitHub fetching is a separate fixed-origin capability. TypeScript syntax parsing occurs in a resource/time-bounded worker with an empty environment; report publication validates provenance and current tenant authority. This static parser worker is not the future customer-code runner or an OS sandbox. Architecture observations cannot enter Phase 1 evidence admission or mint gate outcomes.

Mission: build trust infrastructure for AI-native software. LaunchGate is the first product, focused on business-invariant release assurance. Runtime monitoring, agent action gating, compliance evidence and assurance intelligence remain later product directions.

## Trust and deployment boundaries

| Boundary | Responsibility | Must not receive/do |
| --- | --- | --- |
| CONTROL PLANE | Next.js UI/API, verified identity, future organization authorization, policy confirmation, run scheduling, evidence review | Execute customer code, install customer dependencies, treat model output as evidence |
| PostgreSQL | Durable metadata, transactional usage reservations, inbox/outbox, job leases, tenant constraints/RLS | Store unrestricted executable instructions or plaintext customer secrets |
| ORCHESTRATOR | Trusted long-lived worker, authorization revalidation, sandbox creation, narrow credential leases, cleanup, retries | Execute customer code in its own process or trust unvalidated runner reports |
| UNTRUSTED RUNNER | Ephemeral isolated execution of bounded source analysis and registered tests | Control-plane credentials, ambient cloud identity, host sockets, unrestricted egress |
| CUSTOMER TARGET | Explicitly authorized preview/staging/sandbox deployment with synthetic users/data | Implicit authorization based on repository ownership or public availability |
| EXTERNAL PROVIDER | GitHub, Vercel, Stripe/Razorpay, OpenAI/Anthropic under explicit provider adapters | Authority to decide invariant truth merely through model text or unsigned events |
| Private artifact storage | Encrypted source snapshots, redacted observations, traces and manifests | Public buckets or unscoped signed URLs |
| Secrets service | Managed encryption, short-lived scoped leases and rotation | Secrets in browser payloads, model prompts, source archives, logs or artifacts |

The Next.js/Vercel application stays the control plane. Customer source, build scripts and test execution must run outside it. Start with PostgreSQL-backed durable jobs and one separately deployed orchestrator plus isolated microVM/managed sandboxes. Do not add Kafka, Kubernetes or Redis without measured need. Jobs use at-least-once delivery, idempotency keys, leases, heartbeats, fencing, bounded retries and a dead-letter workflow. Side effects require transactional ledgers/outboxes; “exactly once delivery” is not assumed.

## Integration boundaries

GitHub App installations are scoped to selected repositories: metadata/contents/PR reads and Checks write, deployment read where necessary. Optional remediation requires separately enabled Contents/PR write; no automatic merges, admin grants, secrets reads or workflow-write permission. OAuth state binds initiating user and organization. Signed webhook inboxes deduplicate deliveries. Installation tokens are short-lived and never exposed to customer code.

Vercel previews bind repository, immutable commit SHA and deployment ID. Verify provider events and re-fetch metadata. Preview aliases are not stable candidate identities. Inject protection bypass only into requests to the authorized exact host; strip on redirects. Neither a deployment event nor GitHub access proves authorization to test.

Stripe/Razorpay are both future verification adapters and potential LaunchGate billing adapters. Test customer business logic with safe modes and synthetic resources. LaunchGate's own billing uses organization accounts, event inboxes, authoritative provider reconciliation and transactional entitlement grants, not the current replay-sensitive StartupX activation helper.

OpenAI/Anthropic support source interpretation and bounded remediation proposals. Repository content is untrusted data. Model output never becomes a test verdict, authorization, gate decision or attestation. Private source is not used for training by default; processing, minimization and provider retention must be disclosed.

## Contracts now

- `@launchgate/invariant-spec`: strict versioned schemas for bindings, preconditions, approved operation IDs, deterministic oracles, severity, provenance and confirmation.
- `@launchgate/contracts`: candidates/runs, evidence, target authorizations and Reference Lab families.
- `@launchgate/verification-core`: pure assertion recomputation and policy evaluation. No network, persistence, execution, signing or attestation issuance.
- `src/server`: server-only environment, verified principal and safe API-error foundations.

Package exports target TypeScript source and are private npm workspaces consumed by the existing TypeScript/Next.js toolchain. There is no repository-wide build framework. Future distributed services will require their own compiled deployment outputs.

Decision scope includes organization, project, commit SHA, deployment, invariant version, policy ID/version and evidence scope. Approved-spec digest binds the complete plan; evidence digest binds admitted manifest contents. Unknown extra fields are rejected. Approved operations reference a finite registry, never generated shell, SQL, JavaScript or arbitrary URLs. Runtime adapters must enforce authorization and ceilings even for schema-valid operations.

`PASS` means the bounded assertions held with working positive controls. `REPRODUCIBLE_FAILURE` requires deterministic original and separate reproduction attempts with matching scope, plan, fixture seed/reset state, observed failure signature and complete provenance. Every other state is `INCONCLUSIVE`. NOT_APPLICABLE is separately recorded metadata and contributes no pass. A policy with no required applicable tests cannot ship vacuously.

The gate recomputes outcomes rather than trusting supplied verdict strings. SHIP requires all required applicable invariants to pass for the exact candidate. BLOCK requires a reproduced finding at a policy-blocking severity. An optional nonblocking failure may coexist with SHIP; a required nonblocking failure prevents SHIP but is not mislabeled BLOCK. Missing/duplicate submissions are incomplete. Coverage requirements and reproduced-failure checks must be published separately to GitHub; inconclusive coverage must not accidentally be mapped to a successful required check.

### Evidence admission is a security boundary, not cryptography implemented here

The default admission is UNTRUSTED. REFERENCE_LAB admission works only with REFERENCE_LAB scope. Customer evidence requires a trusted service's AUTHENTICATED_RUNNER admission bound to run ID and manifest digest. **This marker is not a cryptographic receipt**: JavaScript callers can construct it. Do not deserialize it from requests, model output or runner payloads. A later ingestion service must authenticate runner leases, fetch/check artifact bytes and hashes, verify authorization and provenance, then supply admission. Phase 1 does not provide that service and must not be deployed as a public gate API. Tests exercise that contract with synthetic data only. No VERIFIED state or attestation issuer exists.

## Future layout and data model

Keep `src/app` for application UI/APIs and `src/server` for trusted services. Add `services/orchestrator`, `services/runner`, `packages/cli` and provider/fixture adapters later. Shared contracts remain below all service layers. Reference Lab executable fixture applications will live under `reference-lab/`, never imported into production application code.

Future organization-owned entities: memberships/invitations, projects/project access, integrations/repositories/source snapshots/architecture graphs, environments/deployments/authorization proofs, immutable invariant/policy versions, fixture sets/test identities/cleanup tasks, runs/attempts/leases, artifacts/manifests/observations, findings/replays/fix PRs/regressions, check runs/attestations/share links, billing accounts/subscriptions/purchases/refunds/usage reservations, job inbox/outbox, audit and deletion tasks. Composite tenant foreign keys and RLS complement API authorization. No migrations are created in Phase 1.

Future web loop: connect → authorize → discover → confirm → provision → test → evidence → reproduce → fix PR → exact replay → regression → ship/block/inconclusive. Scope includes auth/session, tenant/role, billing/entitlement, replay/idempotency, AI cost/quota/concurrency, browser journeys and build/migration safety. Exact replay changes the candidate build but preserves logical fixture recipe and failure oracle, not expired credentials.

Public CLI defaults to local/static analysis without uploading private code. Public repo assessment cannot authorize target requests or earn a dynamic verification badge. Future badges bind signed evidence, exact candidate and scope, expire and revoke; no universal security guarantee. LaunchGate billing supports Free, Launch Pass, Launch, Pro and Studio with organization budgets; final prices/limits require cost measurements.

## Operational requirements (future)

Use separate development/staging/production data, keys and provider accounts. Redact before log/artifact persistence. Correlate organization/project/run/job/attempt; monitor queue age, failed cleanup, lease expiry, artifact rejection, spend and provider failures. Validate disaster recovery (proposed RPO 24h/RTO 4h) and deletion across active data, artifacts, caches and backups. Proposed retention: source 24h, artifacts 30d, finding metadata 90d, audit 180d; customer configuration and legal retention remain unresolved. Revocation immediately stops new work; active runners must terminate within a measured 10s goal.

## Toolchain

Node 24.19.0 is the locally validated runtime, declared in `.node-version`; engines restrict to Node 24 (minimum 24.19) and npm 11. Next 15.5.27 declares Node >=20 support. Local root install/typecheck/lint/test/build validate this choice; no speculative downgrade. CI uses the same Node declaration. Unit tests use Node's `react-server` condition to load genuine `server-only` modules without replacing or mocking the boundary; Next's production compiler still enforces client import restrictions. Browser component tests will need a separate non-server test entrypoint later.

## Phase 4 execution foundation (2026-10-12)

A browser-authorized command creates a provenance-bound run and PostgreSQL job transactionally. The separate orchestrator reserves shared budgets, leases an attempt with a monotonic fence, and signs narrowly scoped runner authority. The fixed runner performs only an authorized root GET; authenticated ingestion seals transport observations and the run remains UNOBSERVABLE as a verification result. Cleanup must confirm backend termination before retry or reservation release.

See [orchestration](orchestration.md), [target authorization](target-authorization.md), [runner security](runner-security.md), [Vercel integration](vercel-integration.md) and [evidence ingestion](evidence-ingestion.md). Migrations 018/019 add bounded execution records and commands with forced RLS, no browser trusted-state writes, append-only evidence and composite provenance constraints. Existing source-analysis jobs remain separate; this orchestrator schedules Phase 4 verification jobs, not a retroactive implementation of all future job kinds.

Production runner hosting, egress enforcement, key management and artifact lifecycle scheduling are deployment prerequisites. The backend interface and service loop are implemented; no cloud sandbox or live provider validation is claimed. No customer code, dynamic attack suite, production monitoring, fix PR or Verified badge is enabled.

## Phase 5 controlled dynamic engines (2026-10-12)

The first executable authentication, tenant and privilege engines now run in the dedicated [Reference Lab runtime](reference-lab-runtime.md). The existing invariant/evidence/outcome contracts feed a fixed plan compiler and a local RunnerProvider. Phase 4 schedules and fences its work; a trusted control-plane evaluator derives outcomes from selected response and before/after state, requires positive controls and disposes/reprovisions before reproduction. Production customer-target transport remains separate and unchanged.

Migrations 020/021 add tenant-scoped fixture mappings, immutable test plans/traces, findings/occurrences/events, sealed reproduction bundles, replay requests and native regressions. Lab deployments have explicit REFERENCE_LAB provenance and no fabricated GitHub/Vercel connection. Their source digest identifies controlled source bytes; the legacy commit_sha field is a lab content revision, not a Git commit. Customer runs still require their source snapshot.

See [verification engine](verification-engine.md), [findings](findings.md) and [reproduction](reproduction.md). Exact-plan fixed replay can resolve the scoped finding; reintroduction fails its native regression. No arbitrary customer deployment, browser journey, repository execution, fix PR, UI redesign or public attestation is enabled. The earlier Phase 4 limitations remain for production hosting, live integrations, external isolation and operational lifecycle management.
## Phase 6 extension

Billing verification reuses Phase 4 scheduling/grants/accounting and Phase 5 immutable plans, control-plane outcomes, evidence, findings and replay. The reserved local lab provider adds a private SQLite billing fixture and synthetic provider adapter; it does not route through production target networking or StartupX payment routes. Migration 022 extends existing lab families, reserved-host capabilities and bounded authorization budgets without customer billing tables. See [billing architecture and execution](billing-verification.md), [webhook transactions](webhook-verification.md) and [entitlement policy](entitlement-model.md).
## Phase 7 extension

The Reference Lab now dispatches AI cost-control and critical browser journey families through the same immutable compiler, orchestration, grants, evidence, findings and replay pipeline. AI fixtures use two connections to a private SQLite store, a deterministic synthetic provider, reservation and usage state, and a shared rate limiter. Browser fixtures use Playwright Chromium in ephemeral contexts outside Next request handling, with a bounded registered-step interpreter and dedicated loopback mapping.

Migration 023 expands existing fixture families and reserved-host capabilities; it adds no duplicate finding, journey-attempt or usage-observation tables. Versioned journey definitions reside in immutable test plans; attempts and browser metadata use existing sealed evidence. Phase 7 authorizations allow 128 requests/180 seconds with zero financial spend. Production target transport rules and StartupX remain unchanged. See [AI](ai-cost-verification.md), [quota](quota-verification.md) and [browser](browser-journeys.md) boundaries.

## Phase 8 release authority

`services/releases` adds exact candidate/policy identity, explicit coverage, evidence freshness, conservative architecture-based selection, scoped exceptions and immutable evaluation provenance around the existing verification core. Registered lab runs keep their Phase 4 job lifecycle and Phase 5–7 oracles; a signed release-policy binding and shared immutable deployment connect them to one candidate before execution.

Migrations 024–027 separate immutable facts from release state/leases and operational GitHub publication. Browser APIs expose authorized reads and narrow role-checked configuration commands. A separately hosted release worker reconciles signed delivery inbox entries, queues exact snapshots, waits for verified deployment binding, schedules supported verification and updates an exact-SHA GitHub Check. Unsupported verification remains explicit incomplete assurance. Source tokens retain read-only contents permission; publication uses narrowly scoped Checks write. See [release gates](release-gates.md), [coverage](coverage.md), [impact analysis](impact-analysis.md), and [GitHub Checks](github-checks.md).


## Phase 9 constrained remediation

`services/remediation` coordinates consented proposals, exact source validation,
registered patched previews and verified resolution. It reuses Phase 3 syntax and
provenance checks, Phase 4 execution/grants/cleanup, Phase 5 native findings and
replays, Phase 6/7 domain collectors and Phase 8 release policies/coverage.
The analysis GitHub App remains read-oriented; an optional separate App verifies
selected-repository write capability. No model determines a verdict.

Forward migrations 028?031 add scoped proposals, private patch artifacts, local
or provider PR metadata, immutable terminal verification, capability records and
audit events. Private leases and request receipts fence work and retain separate
consent for generation and PR creation. Dispatch affinity isolates patched
preview execution and cleanup from ordinary workers. The default release worker
also excludes remediation-owned candidates; their driver evaluates full policy.

A passing original replay can satisfy its gate item while the finding remains in
FIX_VERIFICATION. Only complete passing policy coverage can transition it to
RESOLVED. Recurrence reopens it as REGRESSION_FAILED without rewriting the earlier
verified proof. Failed/interrupted verification cancels remaining scoped runs and
uses existing cleanup commands to release reservations.

The worker is an explicitly enabled controlled Reference Lab host, not a customer
code sandbox. The live GitHub PR/customer preview workflow is not certified.
See [remediation](remediation.md), [fix PRs](fix-prs.md), and
[verified resolution](fix-verification.md).
# Phase 10 production boundary

The vendor-neutral sandbox contract, production RunnerProvider adapter, scoped
credential broker, private object storage adapter, rotation and durable reaper
live under `services/production`. They reuse Phase 4 grants, target safety,
execution recovery and evidence admission. `src/server/production/runtime.ts`
composes the existing Orchestrator with managed dependencies; no provider is
registered by default. Local remediation startup cannot run in production mode.

Production configuration, integration evidence and readiness are distinct. An
authenticated control-plane service owns qualification records; browser roles
cannot declare VERIFIED. Readiness is rechecked before dispatch and credential
delivery. No production capability was live-qualified in Phase 10: the user
selected credential-free local testing. See [production runner](production-runner.md),
[readiness](production-readiness.md) and [qualification](integration-qualification.md).
