# LaunchGate threat model

Phase 1 establishes contracts; Phase 2 implements the bounded tenancy controls described below. This document also contains the future implementation plan, not a claim that all controls exist. Protected assets: private source, tenant data, credentials, billing entitlements, runner capacity and the integrity of release decisions.

## Phase 2 implemented controls and residual risks

## Phase 3 source and provider controls

- Installation hijacking: verified LaunchGate ADMIN/OWNER, principal/project-bound one-time state, GitHub user installation/repository intersection and repository admin check, then a global App/installation organization binding. Unknown or consumed state and cross-org rebinding are denied in the database.
- Forged provider facts: browser DML and provider-command execution are denied. Raw-body HMAC verification precedes parsing; inbox uniqueness and revocation effects are transactional. Webhooks can revoke but cannot grant, reconnect or trust event ordering to restore access.
- Malicious repositories: exact SHA/tree/blob verification, no checkout/archive extraction, bounded file/byte/path/depth/time budgets, symlink/submodule exclusion and fatal binary/UTF-8 classification. Import/config/package-script text is never executed or resolved.
- Parser denial of service: file/total/AST/output ceilings plus a timed worker with memory limits; stalled blob reads terminate the ingestion promise. Worker threads are not a general-purpose hostile-code sandbox. No hostile code is intentionally executed.
- Source exfiltration/prompt injection: parser receives bounded redacted source and an empty environment, with no model provider or outbound-network hook. Only paths/hashes/static enums and fixed proposal language are persisted. Redaction is heuristic; no promise of perfect secret detection is made.
- Static false assurance: SQL is lexical evidence, symbol/helper matching is explicitly uncertain, and graph edges denote co-location only. Every proposal requires human confirmation; review creates an immutable version, never PASS/BLOCK/VERIFIED.
- Stale authority: ingestion checks current lease/membership/connection/installation between source reads; publishing rechecks under database locks. Disconnect/provider revocation invalidates queued/running leases. In-flight network reads may finish, but subsequent reads/publication are denied.
- Operational residuals: live GitHub OAuth/App setup is UNVERIFIED; callback UI bridge, production worker deployment/scheduling, distributed quotas, exact Supabase type generation and retention cleanup remain outstanding. Static processing does not authorize target traffic. Existing build advisories are unreachable from the supported source pipeline but remain assessed release risks.

The Phase 2 controls below continue to apply.

- Forged browser organization IDs and missing application filters: caller-token RLS independently isolates every new tenant table. Real SQL and PostgREST tests deny outsider access, including unfiltered lists and guessed UUIDs.
- Self-escalation and last-owner races: no direct browser DML; security-definer commands verify current identity/role under an organization lock. A trigger protects the last owner; concurrent demotion tests exercise the invariant. Disabled/removed memberships lose access. Legacy internal/admin roles grant no LaunchGate role.
- Cross-tenant references: composite FKs bind projects to secret/retention rows, requests to tasks and actor membership to audit. Privileged fixture tests prove malformed references fail independently of RLS.
- Service-role overuse: no service-role client in new routes; explicit table/command grant revocations. BYPASSRLS tests are separate from user tests. Migration identities/superusers remain trusted and can change the schema.
- Audit forgery: security events are generated transactionally inside authorized commands, not browser inserts. Immutable snapshots and append-only permissions/trigger protect history. Denied-attempt telemetry and cryptographic tamper evidence remain future work.
- Secret exposure: no secret material column or resolution route. Opaque backend locator is excluded from browser column grants. A future secret backend must validate authenticated leases, current scope and revocation; an interface alone does not implement these controls.
- Deletion races: owner authorization/status/tasks/audit commit atomically; normal future access stops. Cleanup is not executed. External credential revocation, legal hold separation, exports, backups and worker retry/lease correctness remain unproven.
- Resource abuse: body size and list results are bounded, but durable rate limits/organization creation quotas are not implemented. Harden these before opening public self-service at scale. Remaining build-tool advisories are tracked in dependency-audit.md.

See [tenancy.md](tenancy.md) for exact grants, commands and test boundaries. Full hosted Supabase Auth verification and production schema/configuration inspection remain staging acceptance work. No customer database was used for tests.

| Threat | Boundary / required control | Evidence required | Phase |
| --- | --- | --- | --- |
| Malicious repository / arbitrary command execution | Never execute customer code in CONTROL PLANE or ORCHESTRATOR; isolated runner without ambient identity | Hostile build scripts cannot read host/service secrets | 3–4 |
| Path traversal / symlink escape | Canonical extraction roots, reject links/unsafe paths, bounded file access | Traversal and symlink corpus | 3 |
| Hostile archives / bombs | File/byte/depth/expansion/time ceilings before ingestion | Bounded termination fixtures | 3 |
| SSRF / DNS rebinding | Egress gateway pins validated public destination at connection time | Rebinding fixture cannot reach internal address | 4 |
| Redirect escape | Revalidate every hop; strip credentials across origins | Redirect chain reaches no unauthorized host | 4 |
| Metadata-service access | Deny metadata and link-local routes at network boundary | Cloud metadata fixture denied | 4 |
| IPv4/IPv6 private-address access | Canonical address classification including mapped addresses; deny private/loopback/link-local | Address-encoding matrix | 4 |
| Prompt injection in source | Model sees data, not tool authority; schema-only proposals and confirmed allowlisted operations | Prompt cannot schedule arbitrary operations or create failure | 1, 3–4 |
| Malicious customer target | Treat bodies, headers, downloads and browser content as hostile; bounded reads and sandbox browser | Oversized/slow/malformed response fixtures | 4, 7 |
| Credential theft | Scoped leases, brokered provider calls, exact-host injection; redaction before storage | Exfiltration fixture and artifact secret scans | 4 |
| Cross-organization access | Verified principal, membership checks, tenant FKs, RLS and scoped object access | API/SQL/storage/job negative matrix | 2 |
| Forged runner evidence | Authenticate run lease, recompute assertions, validate artifacts and bind manifest digest; never accept admission from request | Forged lease/hash/scope rejected; Phase 1 tests semantics only | 1, 4 |
| Duplicate events/jobs | Durable inbox/outbox, unique provider-account/event keys, fenced leases and transactional effects | Duplicate/crash/retry fault injection | 4, 6, 9 |
| Replay attacks | Signed provider events, dedupe and event reconciliation; replay proof bound to exact scope/seed/plan | Old evidence cannot approve/block new candidate; event replay cannot renew access | 1, 6 |
| Privilege escalation | Member cannot modify roles/authorization; owner controls sensitive policy | Direct SQL/API and role matrix | 2, 5 |
| GitHub token misuse | Selected repositories, least privilege, short-lived tokens, optional separate remediation write capability | Installation isolation/revocation tests | 3, 8 |
| Vercel preview credential leakage | Exact host header injection, strip redirects, no URL/log credentials | Cross-host redirect and trace scans | 4 |
| Payment-webhook manipulation | Raw-body signature verification, account/mode binding, transactional ledger, authoritative reconciliation | Forgery/duplicate/reordering/failed-payment tests | 6, 9 |
| Model-output trust boundary | MODEL_OUTPUT/USER_CLAIM cannot produce pass or reproduced failure; no attestation issuer | Negative outcome/gate tests | 1 |
| Quota races / cost abuse | Reserve budget atomically before work; refund/finalize idempotently; distributed rate enforcement | Concurrent requests never exceed reserved ceiling | 2, 7 |
| Evidence publication leakage | Private by default, explicit redacted publications, expiring share tokens, revocable attestations | Unauthorized/share/revocation tests | 9 |
| Deletion/retention gaps | Enumerated deletion jobs, immediate denial, credential revocation and backup expiry | End-to-end deletion/export drill | 2, 10 |

Target authorization requires control proof, authorized principal, exact hosts/ports/operations, validity window, ceilings and revocation state. Repository access is not an allowed authorization method. The schema is not DNS validation or proof verification. Runtime must additionally verify organization authority, current time, revocation and provider test mode on every run.

Initial proposed safety ceilings: HTTPS 443, two requests/second, burst five, two general concurrent requests, max ten for approved concurrency suites, 1000 requests/15 minutes per attempt, bounded body/artifact bytes and reserved AI spend. Stop on scope escape, authorization revocation, live payment mode, fixture escape or budget exhaustion. These policies will be implemented later; schema maxima are structural upper bounds, not default authorization.

Schema-valid data is not authenticated evidence. A model can fabricate JSON and hashes. The future ingestion service—not a JSON field—must establish who executed a test and validate its bytes and scope. Runner code and customer targets cannot mint trusted admission. No Phase 1 function signs or issues a LaunchGate attestation.

Current StartupX risks remain: replay-sensitive payment activation, missing capture validation, post-work usage accounting/non-atomic fallback, unrestricted usage RPC grants in migration 007, incomplete parent-ownership RLS, missing recovery-session handling, process-local rate limiting and incomplete fetch egress controls. Do not describe these as repaired by Phase 1 contracts. Historical migrations must not be edited; future repairs use new migrations and real database tests.

## Phase 4 target, runner and evidence controls (2026-10-12)

- Confused-deputy target access: verified repository access is insufficient; explicit ADMIN/OWNER deployment authorization and current provider proof are required.
- SSRF and DNS rebinding: HTTPS/443 exact hostname, all-answer public-address validation, actual connection pinning, normal TLS verification, no proxy environment or redirect following. Tests use synthetic DNS/transport and one local server only.
- Stolen or stale runner capability: Ed25519 audience/expiry/JTI/attempt/fence binding; single-use START; live database checks before requests, heartbeats and evidence publication. Capabilities must stay out of logs.
- Crash/replay/budget races: organization locks, transactional job/reservation creation, monotonic attempts, duplicate digest handling, retry limits and durable cleanup. Reservations are not released merely because a lease expired.
- Forged evidence or secret smuggling: strict bounded numeric transport metadata, canonical artifacts and verified hashes; arbitrary Phase 1 assertion evidence remains unavailable without an executor. Browser/model/source authority cannot publish trusted manifests.
- Tenant confusion: forced RLS, no trusted-table DML grants, private leases/credential references, composite tenant/project/commit/version/attempt/run constraints. Current memberships are rechecked.
- Cancellation: immediate durable intent and grant denial, one-second runner polling, bounded control request timeout, provider termination/cleanup hooks. In-flight effects cannot be undone.
- Host compromise: service separation is not a sandbox. Production provider must enforce isolated execution and scoped egress independently. No customer code runs in Phase 4; no worker_threads/Docker sandbox guarantee is asserted.

Residual risks: live Vercel field/permission validation is UNVERIFIED; proof freshness is bounded to one hour and explicit local revocation is immediate. No Vercel webhook revocation feed is implemented. Backend kill latency, real egress isolation, production storage encryption/retention and key rotation are not proven by local protocol tests. An authorized target can still have unsafe GET semantics; Phase 4 supports only explicitly authorized non-production deployment scopes.
# Phase 5 local dynamic verification boundary

Phase 5 adds intentionally vulnerable synthetic HTTP applications in `reference-lab/`, outside the Next routes. Only the local harness creates their random loopback origins and private scope capabilities. The production target client rejects REFERENCE_LAB grants; public-IP/DNS/redirect protections are not relaxed. These tests do not establish production sandbox safety.

Threats addressed: status-code false positives; broken controls masquerading as fixes; unobserved side effects; unreproduced or differently reproduced violations; stale concrete IDs; model-created proof; changed plan/source/variant at admission; expired/revoked grants; cross-tenant finding links; browser mutation of trusted outcomes; duplicate/superseded replays; cancellation leaving verification pending. Defenses are fixed operation/oracle compilation, positive controls, selected-state comparison, fresh disposable reproduction, signed bounded grants, live fence/authority checks, immutable manifests, tenant composite keys, forced RLS and server-owned lifecycle transitions.

Fixture sessions and scope capabilities are memory-only and excluded from evidence. Stored UUIDs identify synthetic users/resources only. The trusted observation API and local host are inside the lab trust boundary. A compromised host/control-plane signer, malicious fixture implementation or arbitrary customer application is not covered by these proofs. Request accounting includes health/observation/control/reproduction; cleanup uncertainty makes evidence inconclusive. Real production key management, isolation, storage retention/deletion scheduling and provider kill drills remain open.
## Phase 6 billing threats

Controlled cases cover client price/currency authority, activation before capture, forged signatures, account/payment binding, duplicate and concurrent effects, delayed replay renewal, stale-event overwrite and policy-dependent entitlement drift. Valid captured positive controls and actual paid-feature probes prevent a disabled payment path from masquerading as a fix. The fixed fixture commits inbox deduplication and business mutation atomically; a local two-handler barrier exercises the race, without claiming distributed transaction certification.

LIVE mode stops independently of host permission. Unknown policy/state, incomplete observations and cleanup uncertainty are inconclusive. Fresh fixture identifiers, bounded safe event metadata and service-only sealed admission preserve the existing tenant/evidence trust boundary. Browser writes and cross-org reads are denied in populated billing tables. No provider credentials, raw signatures, live charges or customer code enter the fixture. Provider contracts are narrow synthetic models; production reconciliation, partial refunds, proration and live compatibility remain unverified. See [webhook verification](webhook-verification.md).
## Phase 7 AI and browser threats

Synthetic adversaries exercise anonymous provider access, premium-model overrides, quota checks after work, concurrent reservation races, aggregate organization bypass, process-local rate limits, misleading 429 responses and forged client cost estimates. Fixed fixtures reserve before provider invocation, reconcile explicit failed-call policy and observe actual provider/ledger effects. Unsupported or unknown policies never receive a guessed oracle.

Browser plans cannot contain arbitrary scripts, selectors or URLs. Ephemeral contexts block service workers, downloads, JavaScript and WebSockets. Approved 303 redirects are followed by separately authorized interpreter navigation, closing Playwright's automatic redirect-routing gap. External scope escapes remain inconclusive safety stops. Selected evidence excludes full DOM, cookies and console text. These controls are not an OS sandbox or production browser egress certification.

Fresh reproduction compares logical provider state/counts and browser checks/business state as well as existing failure signatures. A disabled AI feature or broken authenticated browser control cannot pass. Existing service-only admission, forced RLS, immutable artifacts and project/deployment/authorization binding cover new evidence. Neither real AI providers nor production StartupX routes are invoked. See [browser safety details](browser-journeys.md).

## Phase 8 release-gate boundaries

- A browser, repository or model cannot supply admitted evidence, coverage status, freshness, deployment identity, gate decision or GitHub conclusion. Forced RLS and revoked direct DML protect release facts; the trusted worker re-verifies sealed bundle hashes and recomputes assertions.
- Commit/deployment/policy/invariant/runner/test/plan changes invalidate reuse. Source provenance and persisted complete dependencies are required for historical finding carry-forward. Ambiguous impact broadens testing; required coverage is never optimized away.
- Exceptions are explicit OWNER/ADMIN actions with scope, reason and bounded expiry. They remain visible, auditable and separate from PASS. Cross-organization references use scoped foreign keys.
- Publication binds exact SHA and expected App identity. Incomplete assurance maps to action_required, never neutral/skipped/success. Same-SHA operational updates are fenced/serialized and retain immutable local evaluation history. GitHub has no create-check idempotency header; uncertain POST retries reconcile external IDs, while ambiguous duplicates fail closed.
- Signed events request discovery but cannot establish repository permissions or deployment ownership. Fork PRs are excluded in V1. Verified deployment arrival remains an existing provider-ingestion responsibility. No customer code, generated attack script, fix PR, auto-merge or live credential test is introduced.
- Check summaries exclude raw payloads, evidence, secrets and free-form model/customer text. Required-check configuration and bypass permissions are controlled by repository administrators; live merge blocking is unverified without credentials and a configured ruleset.
