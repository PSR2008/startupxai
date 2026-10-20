# Complete V1 acceptance ledger

Status describes end-to-end V1 capability, not whether a type or foundation exists. Future criteria remain NOT_IMPLEMENTED; PARTIAL_PHASE_2, PARTIAL_PHASE_3, PARTIAL_PHASE_4 and PARTIAL_PHASE_5 record bounded local evidence without declaring the complete V1 criterion achieved. Completion requires recorded CI/integration/artifact evidence, not editing this status column alone.

| ID | Description | Required evidence/test | Planned phase | Status |
| --- | --- | --- | --- | --- |
| BASE-01 | Existing StartupX compiles and tests | Phase 0: 176 tests, typecheck/lint/build passed | 0 | BASELINE_PROVEN |
| LG-01 | Root install/checks/build reproducible in CI | Lockfile install, pinned Node, full CI run | 1, 10 | NOT_IMPLEMENTED |
| LG-02 | No unassessed critical/high dependency exposure | Versioned advisory/path/remediation review; release fixes validated | 1, 10 | NOT_IMPLEMENTED |
| LG-03 | Fresh and upgraded database work | Empty DB and representative StartupX snapshot migration tests | 2 | PARTIAL_PHASE_2 |
| LG-04 | All tenant surfaces isolated | Cross-org API/SQL/storage/jobs/streams/CLI/integration tests | 2, 10 | PARTIAL_PHASE_2 |
| LG-05 | Member cannot promote itself or authorize targets | Role matrix and direct database/API adversarial tests | 2, 5 | PARTIAL_PHASE_5 |
| LG-06 | GitHub connection is least privilege | Install/select/revoke/webhook/permission tests | 3 | PARTIAL_PHASE_3 |
| LG-07 | Repository ingestion cannot execute/escape | Hostile archive, symlink, path and install-script corpus | 3–4 | PARTIAL_PHASE_3 |
| LG-08 | Architecture discovery is attributable | Source SHA/file/line mapping against supported reference apps | 3 | PARTIAL_PHASE_3 |
| LG-09 | Ambiguous invariants require confirmation | Confirmation/version and policy-change browser/API tests | 3 | PARTIAL_PHASE_3 |
| LG-10 | Target testing requires current explicit authorization | Challenge/provider ownership, time/revocation, exact scope tests | 4 | PARTIAL_PHASE_4 |
| LG-11 | Public repo assessment never authorizes target requests | Network trace and denied dynamic-run tests | 3, 9 | PARTIAL_PHASE_4 |
| LG-12 | Synthetic setup and cleanup are bounded | Identity/data provisioning/reset/cleanup fault injection | 4 | PARTIAL_PHASE_5 |
| LG-13 | Runner isolation contains hostile code | Escape, metadata, filesystem, IPv4/IPv6, DNS/redirect fixtures | 4 | PARTIAL_PHASE_4 |
| LG-14 | Cancellation stops new work and terminates within 10s | Measured revocation/kill drill | 4 | PARTIAL_PHASE_4 |
| LG-15 | Retries and duplicates do not duplicate side effects | Worker crash, stale lease, webhook replay and outbox tests | 4, 6, 9 | PARTIAL_PHASE_4 |
| LG-16 | Evidence admission authenticates actual execution | Lease/signature/hash/origin tamper tests with stored artifacts | 4 | PARTIAL_PHASE_5 |
| LG-17 | Models cannot mint failures, blocks or attestations | Phase 1 negative semantics plus end-to-end prompt injection tests | 1, 3–4, 9 | PARTIAL_PHASE_5 |
| LG-18 | Every blocking finding has deterministic reproduction | Original/replay artifacts, controls, matching oracle and scope | 5–8 | PARTIAL_PHASE_5 |
| LG-19 | Missing setup/control/credentials/timeouts are inconclusive | Phase 1 semantics plus runner failure scenarios | 1, 4–7 | PARTIAL_PHASE_5 |
| LG-20 | Auth/session/recovery boundaries verified | Vulnerable/fixed/inconclusive executable fixtures | 5 | PARTIAL_PHASE_5 |
| LG-21 | Tenant/role/ownership/storage invariants verified | Read/write/escalation fixtures across roles and tenants | 5 | PARTIAL_PHASE_5 |
| LG-22 | Billing/entitlement lifecycle verified | Stripe AND Razorpay safe-mode success/failure/monthly/yearly/change/cancel/expiry/refund matrix | 6 | NOT_IMPLEMENTED |
| LG-23 | Webhook signature/duplicate/replay/order safety verified | Concurrent/reordered provider test event matrix | 6 | NOT_IMPLEMENTED |
| LG-24 | AI anonymous/paid/quota/cost boundaries verified | OpenAI/Anthropic adapter tests and bounded provider observations | 7 | NOT_IMPLEMENTED |
| LG-25 | Budgets reserved before work under concurrency | Distributed race tests, crash/refund/finalization ledger | 2, 7 | PARTIAL_PHASE_4 |
| LG-26 | Critical happy/unhappy browser paths verified | Playwright journeys on vulnerable/fixed revisions | 7 | NOT_IMPLEMENTED |
| LG-27 | Build/configuration/migration safety verified | Disposable DB migration/build/environment fixtures | 7 | NOT_IMPLEMENTED |
| LG-28 | Every major domain has Reference Lab triplets | Executable fixture apps; Phase 1 pure cases are partial evidence | 1, 5–7 | PARTIAL_PHASE_5 |
| LG-29 | Fix PRs stay within authorized scope | Patch validation, no merge/workflow privilege, PR tests | 8 | NOT_IMPLEMENTED |
| LG-30 | Exact replay preserves oracle and fixture recipe | Vulnerable → fix build replay; adjacent positive controls | 8 | PARTIAL_PHASE_5 |
| LG-31 | Permanent regressions fail before and pass after fix | Same test on original/fixed revisions | 8 | PARTIAL_PHASE_5 |
| LG-32 | Commit/deployment A cannot approve or block B | Phase 1 scope tests plus real GitHub/Vercel integration tests | 1, 9 | PARTIAL_PHASE_4 |
| LG-33 | Missing coverage cannot become successful required check | Branch protection/check conclusion integration tests | 9 | NOT_IMPLEMENTED |
| LG-34 | Verified badge is scoped, expiring and revocable | Signing, stale candidate, expiry/revocation/publication tests | 9 | NOT_IMPLEMENTED |
| LG-35 | CLI and public assessment operate self-service | Fresh machine local/no-upload and hosted auth/run flows | 9 | NOT_IMPLEMENTED |
| LG-36 | LaunchGate billing manages all paid access paths | Free/Pass/Launch/Pro/Studio purchase/renewal/cancel/refund/dedupe tests | 9 | NOT_IMPLEMENTED |
| LG-37 | Retention/export/deletion is complete | DB/blob/cache/credentials/publication/backups deletion drill | 2, 10 | PARTIAL_PHASE_2 |
| LG-38 | Restore meets proposed RPO 24h/RTO 4h | Timed backup recovery exercise | 10 | NOT_IMPLEMENTED |
| LG-39 | Capacity and cost ceilings hold | Load tests, request counts, measured provider spend, fairness | 7, 10 | NOT_IMPLEMENTED |
| LG-40 | UI is accessible and honest | Keyboard/mobile/accessibility review, no fake results or progress | 9–10 | NOT_IMPLEMENTED |
| LG-41 | Full fresh-account loop needs no operator edits | Signup → connect → authorize → find → fix → replay → gate browser recording | 10 | NOT_IMPLEMENTED |
| LG-42 | Live integrations are actually configured | Secure credential restoration and authorized non-destructive smoke tests | 10 | NOT_IMPLEMENTED |

## Phase 1 evidence

`launchgate-env.test.ts` checks configuration states, safe serialization, liveness, verified-principal dependency and API errors. `launchgate-invariant-spec.test.ts` checks strict bounded operations and target authorization structure. `launchgate-gate.test.ts` checks positive controls, reproduction, policy, candidate binding, uncertainty and admission. `launchgate-reference-lab.test.ts` contains pure triplets for all eight initial families. These do not establish any live-provider or executable runner criterion above.

## Phase 2 evidence - 2026-10-11

Local Windows/Node 24 validation: **289 application/unit tests passed**, zero failed/skipped (261 existing plus 28 new authorization/API tests). **59 disposable PostgreSQL/PostgREST integration tests passed**, zero failed/skipped. Total: **348 tests passed**. Database execution was available, not BLOCKED_BY_ENVIRONMENT. `npm install`, typecheck, lint and production build passed; lint retains one pre-existing unused-import warning. `npm audit` remains nonzero with 0 critical / 8 high / 3 moderate entries. GitHub CI definition requires database execution but was not run remotely because no push was made.

| Phase 2 requirement | Result and evidence |
| --- | --- |
| Forward migrations; preserve history | PASS: 014/015; historical files unchanged; fresh schema and populated legacy upgrade tests |
| Organizations and explicit ownership | PASS: authenticated create, first OWNER, stable UUID, outsider denial |
| Membership roles and owner safety | PASS: role matrix, uniqueness, soft revocation, transfer, last-owner and concurrent demotion tests |
| Projects | PASS: organization-owned; inherited organization access explicitly documented; no separate project roles |
| Central authorization | PASS: verified runtime principal, typed context, role helpers, safe errors; 28 unit/API cases |
| RLS | PASS for eight implemented tables: real authenticated SQL and JWT/PostgREST denial tests |
| Composite tenant integrity | PASS: project/secret/retention, request/task and membership/audit constraints |
| Durable audit | PASS for successful commands: atomic append events, role snapshots, read restrictions; denied-attempt telemetry deferred |
| Secret foundation | PASS: metadata only, private locator excluded, no material columns, future backend interface |
| Retention foundation | PASS: category/duration/override metadata; actual scheduler/erasure is not implemented |
| Deletion foundation | PASS: owner authorization, pending access denial, seven durable tasks, transition/completion constraints; no worker |
| Versioned API | PASS: minimal tenant/member/project/audit/metadata/deletion routes; no frontend changes |
| StartupX coexistence | PASS for local checks: existing tests, source/migration preservation, populated synthetic upgrade and policy comparison |
| Disposable local DB | PASS: pinned PostgreSQL 17/PostgREST; no ports, mounts or production DB connection option |
| Required security matrix | PASS: 59 integration tests, including SQL grants/RLS, HTTP representations and concurrent owner changes |
| Legacy-risk regression boundaries | PASS: service-role separation, missing-filter RLS, old admin role denied; old defects remain tracked |
| Database types | MANUAL TEMPORARY: narrow reviewed domain types; Supabase CLI generation not available/performed |
| Documentation | PASS: architecture, threat model, acceptance, legacy transition, tenancy operating contract |
| Dependency review | ASSESSED / UNRESOLVED: compatible PostCSS update; no new critical; 11 entries remain |
| Toolchain | PASS: install/typecheck/lint/tests/build/diff checks, with existing lint warning; audit is not clean |
| Scope/Git restrictions | PASS: launchgate-rebuild only; no commit/push/history change, UI redesign, integration or runner implementation |

Limits: the Auth SQL contract and synthetic legacy row are local fixtures, not full hosted Supabase or a customer snapshot. Hosted token verification, real deployed grants/configuration, generated database types, production migration rehearsal, denied-attempt telemetry, distributed abuse controls, credential revocation, retention execution, legal-retention separation, backup expiry and end-to-end deletion remain outstanding. The integration suite does not claim these future capabilities are verified.

## Phase 3 acceptance evidence - 2026-10-12

Local validation: **359 application/unit tests passed**, zero failed/skipped; **80 disposable PostgreSQL/PostgREST tests passed**, zero failed/skipped. Total **439 passed**. The application total includes 44 static-source safety/detection/discovery cases, 22 GitHub/worker contract cases and four new API authorization cases. The database total includes the original 59 Phase 2 cases plus 21 Phase 3 cases. Earlier rehearsal ran the complete historical chain through 015 before schema expansion; the final suite also applies 016/017. Tests are not counted twice for repeated runs.

Install, typecheck, lint, production build and diff whitespace checks passed. Lint retains the existing unused `describe` warning in `public-source.test.ts`; there are no new lint errors/warnings. Full audit remains 0 critical / 8 high / 3 moderate; omit-dev remains 0 critical / 1 high / 1 moderate. Both audit commands correctly return nonzero. All HIGH paths have a documented reachability assessment; none lies on the supported source-ingestion execution path. Remote CI has not run because no push was made.

| Phase 3 completion criterion | Result / evidence |
| --- | --- |
| Customer code is never executed | PASS: pure blob ingestion and syntax parser; no customer install/build/test/emit/module resolution; side-effect sentinel stays absent |
| Malicious repositories cannot escape supported boundaries | PASS: traversal/device/absolute/encoded/deep paths, symlinks, submodules, archives, binary/generated overload, byte/file/time limits and prompt-injection fixtures |
| Immutable snapshot identity | PASS: full SHA required; commit/tree identities and Git blob bytes checked; unique connection/SHA/analysis version |
| Architecture source provenance | PASS: file/blob/content digests and line ranges on graph observations, edges and integration evidence; strict publication validation |
| Deterministic supported-stack detection | PASS: five stack fixtures plus SQL/client-boundary/Vercel observations; DETECTED/NOT_DETECTED/AMBIGUOUS |
| Invariants carry evidence and uncertainty | PASS: all seven required families, explicit assumptions, mandatory confirmation, LOW/MEDIUM prioritization only |
| Model/source text cannot create proof | PASS: no model provider invoked; strict report rejects verdict fields; no call into gate/evidence admission |
| New entities are tenant isolated | PASS: RLS and composite tenant/project/snapshot FKs; browser provenance/inbox/lease forgery denied |
| Webhook signatures and idempotency | PASS: raw HMAC contracts plus real durable inbox deduplication/revocation tests |
| Installation ID cannot be hijacked | PASS: principal/project/selection-bound state, provider intersection/admin contracts, global installation/org uniqueness, real cross-org binding denial |
| Revocation/disconnection stops new reads and publishing | PASS: current-authority checkpoints, database lease invalidation and revalidated fenced publication; already in-flight reads may finish |
| No unassessed HIGH on ingestion runtime path | PASS for supported flow: audited parser/transport path; affected Next/CSS/glob processing is excluded, not declared fixed |
| Existing StartupX remains green | PASS: all pre-existing application and Phase 2 database tests; historical migrations and UI preserved |
| Human review is durable and versioned | PASS: ADMIN/OWNER confirmation/refinement/rejection/deferral, append-only versions and idempotency conflict tests |
| Live GitHub installation/analysis | UNVERIFIED: App configuration absent; no successful live installation fabricated |
| Exact Supabase type generation | BLOCKED_BY_ENVIRONMENT: CLI absent; real disposable PostgreSQL execution passed; narrow manual/runtime types retained |
| Scheduling boundary | IMPLEMENTED INTERFACE: queue/lease/reclaim/check/publish entry point exists; Phase 4 must host/schedule it |

Evidence files: `tests/launchgate-source-analysis.test.ts`, `tests/launchgate-github.test.ts`, `tests/launchgate-tenancy.test.ts`, `tests/database/launchgate-rls.test.ts`. The 44 source cases include five named stack fixtures and seven-family/ambiguous/provenance/SQL checks; these are included in the totals, not extra tests.

Operational limitations remain explicit: OAuth callback UI bridge, production worker deployment/scheduling, hosted Supabase configuration validation, exact generated database types, distributed abuse quotas, source-metadata retention/deletion execution and full interprocedural/SQL semantic analysis are not implemented. Parser workers are resource bounds, not general customer-code sandboxes. Confirmed statements still need future fixture bindings and deterministic execution oracles. Live provider connectivity, dynamic assurance and Verified attestations remain unclaimed.

## Phase 4 evidence - 2026-10-12

Local implementation validation: **434 application/unit tests + 111 real PostgreSQL/PostgREST tests = 545 passed**, zero failures, cancellations or skips. This includes the original 359 application and 80 database tests. New focused suites: orchestration 3, target safety 39, Vercel 12, runner/evidence 17; four additional API tests and 31 additional database cases. Focused suite counts are included in 545, not additional tests.

`npm.cmd install`, typecheck, lint, production build (56 generated pages) and `git diff --check` passed. Lint has one pre-existing unused `describe` warning in `tests/public-source.test.ts`. Full audit changed from 8 HIGH/3 MODERATE to 7 HIGH/2 MODERATE (exit 1); production changed from 1 HIGH/1 MODERATE to zero (exit 0). See the current dependency assessment. No remote CI was triggered because no push was made.

| Phase 4 acceptance requirement | Result and scope |
|---|---|
| Explicit scoped revocable authorization | PASS: OWNER/ADMIN, exact provider deployment/host, current proof, version/expiry and revocation; repository access alone is insufficient |
| Immutable run provenance | PASS: snapshot/deployment commit and authorization version composite FKs, frozen invariant versions, policy/runner version and image digest placeholder |
| Durable jobs, fencing and crash recovery | PASS: PostgreSQL transaction, leases, one-time grant start, monotonic fences, restart recovery, cleanup barrier and three-attempt dead letter |
| Cancellation and cleanup | PASS in controlled tests: intent prevents requests/publication; heartbeat abort; provider termination/cleanup hooks; no release until cleanup confirms |
| Ten-second controlled recognition | PASS: 1006 ms from blocked probe start to transport abort after the first rejected one-second heartbeat; not a cloud provider kill measurement |
| Atomic budgets | PASS: simultaneous database claim transactions admit one two-slot reservation; organization-wide and per-authorization ceilings; request accounting before I/O and cleanup reconciliation |
| Narrow authenticated runner authority | PASS: Ed25519 audience/expiry/JTI/attempt/fence; no DB/GitHub/account-wide Vercel/billing credentials; fixed environment specification |
| Browser cannot forge trusted state | PASS: forced RLS, no DML or worker gateway grants, direct SQL/API denial tests, immediate member revocation |
| Authenticated evidence ingestion | PASS for infrastructure observations: scope/schema/time/sequence/hash checks; immutable manifest; stale/cancelled publication denied; duplicate same-digest completion |
| SSRF and exact allowlist | PASS: IPv4/IPv6/private/mapped/metadata checks, DNS pinning/rebinding fixtures, local synthetic server, redirect stop, no credential forwarding |
| Live payment disallowed | PASS: only root resource.read; TEST_ONLY policy and zero spend; no payment adapter available |
| Dependency security | PASS for implemented runner/target path: production audit zero; remaining build/dev exposures assessed and excluded from customer execution |
| StartupX coexistence | PASS: all existing tests/build remain green, old routes/features and migrations 001�017 preserved |
| Live Vercel E2E | UNVERIFIED: strict contract mocks only; credentials not used |
| Production sandbox isolation | NOT CLAIMED: backend interface and sanitized launch spec exist; real isolation/egress/termination require provider deployment and validation |
| Production orchestration hosting | NOT DEPLOYED: separate service loop/internal handler implemented; host supplies store, signing key, artifact adapter and runner backend |
| Supabase exact generated types | BLOCKED_BY_ENVIRONMENT: CLI absent; real local SQL/PostgREST execution passed |

Phase 4 is the bounded infrastructure foundation. The broader V1 ledger remains partial because there is no customer-code execution, full attack/browser suite, runnable invariant executor, public attestation, production backend or complete live-account onboarding flow. Phase 4 transport metadata never becomes a verified security finding. Source-analysis scheduling remains its existing separate worker entry point. Artifact expiration has an adapter method but needs host scheduling; production storage, key rotation and provider kill drills remain rollout work.

## Phase 5 evidence — 2026-10-13

Final local validation: **508 application tests + 134 real PostgreSQL/PostgREST tests = 642 passed**, zero failed/cancelled/skipped. This preserves all 434 Phase 4 application tests and 111 database tests, adding 70 dynamic Reference Lab tests, four API tests and 23 database cases. Focused suites are included in these totals, not counted twice. The required database run completed in 290 seconds, including the complete four-run finding/fix/regression journey and cleanup; no disposable test containers remained afterward.

| Focused suite (included in application total) | Passed |
|---|---:|
| Reference Lab runtime, false-positive defenses, admission, cleanup | 16 |
| Authentication dynamic | 18 |
| Tenant dynamic | 9 |
| Role dynamic | 12 |
| Reproduction | 7 |
| Fixed replay | 5 |
| Regression | 3 |
| **Dynamic subtotal** | **70** |

Install, typecheck, lint and production build passed; build generated 56 pages. Lint retains only the existing unused `describe` warning in `tests/public-source.test.ts`. Full audit exits 1 with 7 HIGH/2 MODERATE development/build findings; omit-dev exits 0 with zero vulnerabilities. No dependencies were added. npm install emits existing pending-script notices for esbuild/unrs-resolver; no new approval or dependency change was made. Remote CI is configured but not claimed run because nothing was pushed.

| Phase 5 criterion | Result and evidence |
|---|---|
| Vulnerable/fixed/inconclusive authentication | PASS: six registered cases × three variants; protected API/route/action, invalid/expired session and logout |
| Vulnerable/fixed/inconclusive tenancy | PASS: read/write/delete × three variants; Tenant B identifiers substituted into Tenant A requests |
| Vulnerable/fixed/inconclusive roles | PASS: member→owner/admin, viewer→developer, developer→owner × three variants |
| Mandatory positive controls | PASS: owner/authorized equivalent operation and trusted selected-state observation before adversarial step |
| Status codes do not decide outcomes | PASS: 403 side effect fails; sanitized 200/masked 404 need state/control evidence; 500/timeout are inconclusive |
| Deterministic oracle | PASS: strict immutable compiler and control-plane comparison of visibility/existence/tenant/owner/value/role; no model verdict |
| Reproduction required | PASS: fresh disposable state and IDs, same seed/plan/initial hash/oracle; single candidate, second PASS/error/different signature stay inconclusive |
| Exact fixed replay | PASS: original plan/oracle and controls preserved; disabled authorized action with success marker does not pass |
| Native regressions | PASS: vulnerable fails, fixed passes, reintroduced vulnerable fails again; durable expected-PASS JSON, no generated repository code |
| Durable journey | PASS: authenticated synthetic org/project commands through registration, Phase 4 scheduling/grant, two HTTP traces, persisted finding/bundle, fixed replay, regression failure and fixed replay again; no manual DB edits |
| Browser cannot forge results | PASS: API role checks and database denial of attempts/assertions/replay/regression/finding/bundle writes |
| Cross-org finding access | PASS: nine populated tables hidden from outsider; foreign finding parent rejected with a valid foreign run/attempt, including privileged SQL |
| Evidence scope | PASS: sealed private artifact and bundle bound to run/attempt/fence/deployment/authorization/invariant/plan; no fake provider or image identity |
| Replay lifecycle | PASS: completed retry cannot reopen finding; old retry cannot replace active replay; cancelled replay becomes inconclusive |
| Safety/cleanup | PASS: shared 32 requests, 60-second grant, concurrency one, two requests/sec DB ceiling; all probes charged; timeout/cancel/collector error cleanup and visible cleanup uncertainty |
| Production network policy | PASS: lab grants refused by production TargetClient; dedicated controlled local provider; earlier SSRF protections retained |
| StartupX coexistence | PASS: existing application tests and build preserved; migrations 001–019 untouched; no production fixture data |
| Git/scope | PASS: launchgate-rebuild only, Phase 4 HEAD preserved, main/archive refs unchanged; no commit/push/UI redesign/Verified badge |

Scope remains **controlled local Reference Lab only**. No customer deployment, repository code, production sandbox, live provider, browser framework action integration, full Supabase hosting/type generation or remote CI result is claimed. Candidate/reproducing history is admitted atomically with evidence; FIX_PENDING/DISMISSED are reserved, not user-editable workflows. The local harness source SHA-256 is real; its legacy commit_sha field is a synthetic content revision, not a Git commit. Production hosting, egress isolation, key rotation, artifact retention/deletion scheduling and broader V1 criteria remain future work. See [engine](verification-engine.md), [runtime](reference-lab-runtime.md), [findings](findings.md) and [reproduction](reproduction.md).
## Phase 6 evidence — 2026-10-13

Final local validation: **660 application + 148 PostgreSQL/PostgREST tests = 808 passed**, zero failed/cancelled/skipped. This preserves the Phase 5 baseline (508 + 134) and adds 152 billing application tests plus 14 database cases. Focused suites overlap the full run and are not added again. The required database run took 827 seconds, including seven billing journeys and 15 billing runs. Its asserted disposable-container cleanup passed; a later inventory check could not reconnect to Docker after the daemon became unavailable. No billing temporary directories remained.

| Named focused command | Passed |
|---|---:|
| `test:billing-lab` | 152 |
| `test:price-integrity` | 9 |
| `test:failed-payment` | 6 |
| `test:capture-state` | 9 |
| `test:webhook-signature` | 15 |
| `test:webhook-replay` (includes ordering) | 15 |
| `test:billing-concurrency` | 5 |
| `test:cancellation-expiry` | 9 |
| `test:upgrade-downgrade` | 12 |
| `test:refund-policy` | 6 |
| `test:billing-fix-replay` | 6 |
| `test:billing-regression` (same suite as preceding alias) | 6 |
| `test:startupx-dogfood` | 3 |
| `test:billing-provider` | 36 |

The billing total also includes 21 runtime/control/safety tests. Install, typecheck, lint and production build passed. Lint retains the existing unused `describe` warning in `tests/public-source.test.ts`, with zero errors. Production audit: zero vulnerabilities; full audit: seven high/two moderate inherited development/build findings, unresolved. The full audit required a retry after a registry error. No remote CI execution is claimed.

| Phase 6 acceptance criterion | Evidence / result |
|---|---|
| Price/currency authority | PASS: vulnerable mutation reproduced; fixed server catalog passes |
| Failed/uncaptured activation | PASS: failed, created, pending and authorized states cannot grant fixed entitlement |
| Valid captured behavior | PASS: mandatory captured control and actual paid export; reject-all fix is inconclusive |
| Webhook signature integrity | PASS: five invalid forms reproduce vulnerable effects and are rejected by fixed fixture |
| Duplicate/concurrent delivery | PASS: exactly-once business effect with atomic inbox/state transaction; repeated races and rollback tested |
| Delayed replay | PASS: original payment cannot extend period after logical time, connection reopen and unrelated event |
| Event ordering | PASS: stale captures cannot overwrite cancellation, upgrade or refund |
| Cancellation and expiry | PASS: confirmed immediate/period-end rules and deterministic boundary probes |
| Upgrade/downgrade | PASS: confirmed immediate/next-period behavior and credit replacement |
| Refund policy | PASS: revoke/manual-review rules; unknown policy never guessed |
| Paid-feature correlation | PASS: real local protected export compared with persisted entitlement and stable reread |
| Positive controls / uncertainty | PASS: missing controls, unknown state, observation/cleanup errors are inconclusive |
| Reproduction / findings | PASS: fresh state/IDs, same seed/plan/oracle; two matching failures required |
| Fixed replay / regressions | PASS: original oracle preserved; vulnerable fails, fixed passes, reintroduced defect fails |
| Durable E2E A–E | PASS: failed payment, duplicate event, price, uncaptured payment, cancellation/expiry; concurrency also covered |
| Browser forgery / tenant isolation | PASS: populated billing attempts, observations, findings, bundles and regression tables; sealed writes denied |
| Zero financial spend / live stop | PASS: synthetic-only local provider; LIVE blocked independently of host authority |
| Stripe/Razorpay | PASS for 36 synthetic contract cases; live E2E UNVERIFIED for both |
| StartupX dogfood | PASS for three isolated equivalent patterns; production payment code unchanged |
| StartupX coexistence | PASS: all prior tests/build preserved; historical migrations untouched |
| Git/scope | PASS: launchgate-rebuild; no commit/push; main/archive unchanged; no UI redesign or badge |

Migration 022 initially referenced a constraint name replaced by Phase 5's multi-column CHECK. It now resolves the existing operations constraint from PostgreSQL dependencies, fails closed on unexpected schema, and uses an explicit new name. The complete database rerun passed afterward.

Scope remains controlled local Reference Lab. SQLite connection reopen is not OS-process restart certification; the two-handler race is not distributed-provider certification. Partial refunds, proration, grace/trials, live settlement, production egress isolation, browser engines, customer code, automatic fixes and commercial billing are outside Phase 6. See [billing verification](billing-verification.md), [webhook contracts](webhook-verification.md) and [entitlements](entitlement-model.md).
## Phase 7 evidence — 2026-10-14

Final local application run: **809 passed**. Required disposable PostgreSQL/PostgREST run: **162 passed**. Combined: **971 tests**, zero failed/cancelled/skipped. This preserves the Phase 6 baseline of 660 application/148 database tests and adds 149 application/14 database cases. Focused commands overlap these totals and are not counted twice. Database runtime was 1,203 seconds; it exercised six durable AI journeys plus a browser baseline/regressed/fixed/reintroduced release chain, producing 16 Phase 7 runs.

| Focused command | Passed |
|---|---:|
| `test:ai-lab` | 92 |
| `test:anonymous-access` | 15 |
| `test:model-boundary` (same access suite) | 15 |
| `test:quota-boundary` | 18 |
| `test:concurrent-quota` (quota + runtime) | 35 |
| `test:distributed-rate-limit` | 15 |
| `test:cost-ceiling` | 27 |
| `test:provider-failure-accounting` (runtime suite) | 17 |
| `test:phase7-fix-replay` | 9 |
| `test:phase7-regression` (same replay suite) | 9 |
| `test:browser-journey` (journeys + safety) | 46 |
| `test:browser-regression` (same replay suite) | 9 |
| `test:startupx-ai-dogfood` (same replay suite) | 9 |
| Phase 7 cancellation/cleanup file | 2 |

Install, typecheck, lint and production build passed. Lint retains the existing unused `describe` warning in `tests/public-source.test.ts`, with zero errors. Full dependency audit reports seven high/two moderate inherited development/build findings; production audit reports zero vulnerabilities. Playwright 1.64.0 and matching Chromium are explicitly installed for the controlled runner. CI now installs Chromium and has a 45-minute limit for the expanded credential-free rehearsal; no remote CI run is claimed.

| Phase 7 acceptance criterion | Result / evidence |
|---|---|
| Anonymous provider access | PASS: vulnerable invocation reproduces; fixed denies before work with paid control intact |
| Free/premium boundary | PASS: body, query and endpoint manipulation; paid premium access preserved |
| Quota and reservation | PASS: five allowed, sixth denied before provider; 429 after work remains a failure |
| Concurrent quota | PASS: ten-client barrier, one remaining unit, exactly one fixed admission; five repeated fixed runs |
| Organization quota | PASS: multiple identities, sequential and barrier-controlled races against shared state |
| Rate limits | PASS: fixed-window limit, burst, over-limit, concurrency and deterministic reset boundary |
| Distributed limits | PASS: two logical connections/instances reproduce process-local bypass; shared durable key passes |
| Cost ceiling | PASS: server-derived maximum reservation and actual reconciliation; forged client estimate ignored |
| Input/expensive endpoints | PASS: anonymous/free/paid model paths and bounded input/batch/depth representations |
| Failure policy | PASS: NOTHING and RESERVED_ONLY under both synthetic provider families |
| Policy uncertainty | PASS: unknown policy/live mode stop; unsupported catalog combinations rejected |
| Reproduction | PASS: fresh state/IDs and original program; differing overspend/state cannot block |
| Replay/regressions | PASS: original oracle preserved; vulnerable/fixed/reintroduced cycles for seven AI families and browser release |
| Zero real spend | PASS: deterministic provider calculations, no real provider credentials/calls |
| Critical browser journeys | PASS: signup/login, protected/paid access, logout, create/read/update |
| Unhappy paths | PASS: invalid/expired session, server error, missing input/entitlement, exhausted quota |
| Browser controls / cosmetics | PASS: broken authorized control inconclusive; copy-only changes do not create findings |
| Browser target safety | PASS: external redirect and unsupported origin/path rejection; bounded interpreter, no arbitrary scripts |
| Browser cleanup | PASS: context/session disposal, controlled disconnection, navigation timeout and cancellation tests |
| Trust / RLS | PASS: populated AI/browser evidence hidden cross-org; browser writes and sealed evidence mutation denied |
| StartupX dogfood/coexistence | PASS: isolated synthetic Anthropic equivalent detects post-provider accounting; all prior tests/build green; production logic untouched |
| Git scope | PASS: launchgate-rebuild, Phase 6 HEAD preserved, main/archive unchanged; no commit/push |

The first database run exposed a Phase 5 probe timeout while synchronous Docker RPCs blocked the local HTTP event loop. The test-only live execution adapter now uses bounded asynchronous subprocesses; timeout/enforcement rules were not relaxed. The full rerun passed. An earlier focused regression run also detected a source-provenance mismatch while source was being edited; final runs used stable source and passed.

The successful database rerun's cleanup assertions passed. The interrupted first run left `launchgate-rls-08bbf7ce-3b5b-4605-b454-6846acbcc49c` and its `-rest` companion, plus `%TEMP%/launchgate-billing-ENpRWH` and `%TEMP%/launchgate-phase6-irlm0Y`; automatic approval review initially blocked removal. **Cleanup-only review, 2026-10-14: PASS.** Ownership was verified through disposable labels, pinned test images, the paired container network, synthetic billing artifacts, SQLite fixture tables and the exact recorded paths; no directory contained a reparse point. Only those named resources were removed, together with the database container's exclusively attached anonymous test volume. Post-test checks confirm both containers, both directories and that volume are absent, with no additional Phase 7 fixture resources or Playwright browser processes found. Two older October 11 CI/no-environment repository-copy directories were inspected and left untouched. Focused AI runtime, browser safety and cancellation/cleanup suites passed **26 tests**, zero failures/skips. No source code changed during this cleanup review.

Scope limits: controlled Reference Lab only; no live AI/provider certification, arbitrary customer deployment, customer code, generated browser scripts, merge blocking, fixes/PRs or Verified badge. Supported policy is the registered fixed-window catalog, not arbitrary pricing, token buckets or production distributed clock/crash recovery. Browser redirects use explicitly validated interpreter navigation rather than certifying native automatic redirect behavior. Static-to-dynamic correlation is an internal confirmed-binding helper, not automatic customer execution. See [AI cost verification](ai-cost-verification.md), [quota verification](quota-verification.md) and [browser journeys](browser-journeys.md).

## Phase 8 — release decisions, coverage, impact and GitHub Checks (2026-10-14)

Implementation is on `launchgate-rebuild`, based on committed Phase 7 `db776f2`. No commit or push was performed. `main` and `startupxai-final` were not modified. Migrations 001–023 are preserved; forward migrations 024–027 add release persistence and commands.

| Phase 8 acceptance criterion | Evidence |
|---|---|
| Exact candidate | Organization/project, source connection/snapshot, exact SHA, provider deployment, environment, policy version and invariant-set digest; synthetic lab identity is explicit |
| Versioned policy | Append-only policy/requirements with scoped foreign keys and immutable triggers |
| Explicit coverage | Six statuses, required/applicable totals and per-status counts; no score; advisory counts separate |
| Missing/stale assurance | NOT_RUN, STALE and required INCONCLUSIVE cannot approve |
| BLOCK semantics | Existing deterministic evaluator recomputes assertions and fresh reproduction; blocking severity/applicability required |
| Freshness | Commit, deployment, policy, invariant, runner/test/fixture/plan and authorization changes rejected |
| Exceptions | OWNER/ADMIN, exact release/invariant/finding, reason/expiry/actor/ticket/audit; underlying outcome preserved |
| Historical findings | Exact or complete unchanged dependency proof; resolved fresh regression pass permits SHIP, reproduced reintroduction BLOCKs |
| Impact/selection | Validated Phase 3 graph/file provenance, base/head, rename/deletion/structural changes; ambiguous/shared/migration impact broadens |
| Required regressions | Baseline and required coverage always selected; resolved critical regressions retain priority |
| GitHub identity/mapping | Exact SHA and expected App; SHIP success, BLOCK failure, INCONCLUSIVE action_required; no neutral/skipped approval |
| Publication lifecycle | Same-SHA external-ID reconciliation, new-SHA separation, fenced publication, pending assurance before rerun and immutable history |
| Automatic scheduling | Signed deduplicated discovery, source queue, verified-deployment wait, selection, existing run scheduling, terminal-result evaluation and publication |
| RLS/trust | Forced RLS on all 14 public release tables, browser DML/service RPC denial, scoped foreign keys, immutable identity/evaluation |
| Reference Lab A–F | Eight real domains: fixed SHIP; tenant reproduced BLOCK; missing browser INCONCLUSIVE; old commit STALE; resolved passing regression SHIP; reintroduced regression BLOCK |
| Durable cross-domain | PostgreSQL worker scheduled eight runs against one exact deployment; admitted results produced eight PASS items and SHIP |
| Provider-unavailable behavior | Configured synthetic provider contract waits for verified records; absent customer dynamic adapters yields eight NOT_RUN and non-approving check, including rerequest |
| StartupX coexistence | All application tests and production build pass; no StartupX feature removed |

Final local validation, reviewed 2026-10-15: `npm.cmd install`; **865 application tests**, including **56 Phase 8 tests** (20 gate/coverage/exception/applicability, 14 stale-evidence, 13 impact/selection, 8 GitHub contracts, 1 composite cross-domain A–F test); **23 Phase 8 PostgreSQL tests** and **162 existing PostgreSQL/PostgREST regression tests**. Combined: **1,050 unique tests passed**, zero failures/cancellations/skips. Focused suites overlap these totals and are not counted again. Type-check and production build pass. Lint has zero errors and the pre-existing unused `describe` warning in `tests/public-source.test.ts`. `git diff --check` passes. No remote CI run is claimed.

The durable finding regression test proves reproduced BLOCK, fixed replay SHIP, automatic SHIP assurance expiry and reintroduced BLOCK, preserving all three evaluations and audit history. SHIP validity is bounded by evidence freshness, authorization and applicable exception expiry; expiry queues fresh evaluation and a non-approving check. Both database suites' asserted cleanup hooks passed, including removal of their own disposable containers and database volumes. Final inventory on 2026-10-15, after starting Docker Desktop, found no containers with the LaunchGate disposable label or LaunchGate name. No Phase 8 temporary directories remained; only the two previously recorded October 11 CI/no-environment repository-copy directories were present and left untouched. No additional deletion was needed during final review.

`npm audit`: 7 high, 2 moderate, 0 critical, in the existing dev/build dependency tree (`@next/eslint-plugin-next`, `braces`, `chokidar`, `eslint-config-next`, `fast-glob`, `micromatch`, `tailwindcss`, `postcss-nested`, `postcss-selector-parser`). `npm audit --omit=dev`: **0 vulnerabilities**. No new dependency was introduced and no forced breaking audit upgrade was applied.

Validation repairs: the first new migration execution exposed a reserved SQL identifier; a later reconciliation test caught a PL/pgSQL alias collision. Both were corrected in the new forward migrations. The durable fixture initially bypassed pacing and correctly encountered the service request limiter; normal pacing was restored. A lab admission marker mismatch was also corrected without relaxing evidence validation. The final 23-test database run passed. Mandatory database mode now fails instead of reporting an unavailable Docker engine as skipped success.

Scope limits: **live GitHub Checks E2E, live Vercel discovery and actual merge blocking are UNVERIFIED**. Required-check name/expected App and bypass settings must be configured by the repository operator. GitHub Checks has no native freshness TTL: worker/provider outages can delay expiry updates, so operation requires monitoring and fresh reruns after expiry. Provider deployment ownership still comes from the existing verified ingestion path; webhook URLs cannot establish it. Customer dynamic adapters beyond the controlled registered lab remain unavailable and cannot SHIP through missing assurance. Check creation retries reconcile GitHub external IDs; ambiguous duplicate records fail closed. No fix PR, contents-write permission, auto-merge, public badge, UI redesign or Phase 9 implementation was introduced. See [release gates](release-gates.md), [coverage](coverage.md), [impact analysis](impact-analysis.md), and [GitHub Checks](github-checks.md).


## Phase 9 - constrained remediation (2026-10-16; controlled acceptance PASS)

Work is based on committed Phase 8 `53ef4c7` on `launchgate-rebuild`. No commit,
push, history rewrite or main/archive change is authorized or performed.
Forward migrations 028-031 preserve migrations 001-027.

Implemented: separate generation/PR consent, OWNER/ADMIN actions, bounded exact
source proposals, malicious-patch rejection, Phase 3 syntax/provenance validation,
registered patched-source previews, exact replay, mandatory controls/adjacent
regressions, immutable verified proof, permanent native regression and recurrence.
Optional GitHub write authority is a separate App and selected-repository
capability; the analysis integration retains Contents read. Real GitHub PR and
Vercel preview E2E remain UNVERIFIED. The controlled worker creates an explicit
local PR representation, never a fabricated live provider result.

Final application run: **904 passed**, zero failures/cancellations/skips, with
bounded test concurrency. Production build passed. Typecheck passed; lint retains
only the existing unused `describe` warning in `tests/public-source.test.ts`.
Install completed without dependency/lockfile changes; npm reported pending
lifecycle-script approvals for the existing esbuild/unrs-resolver packages, and no
extra approval or dependency upgrade was performed. Production audit reports
**zero vulnerabilities**; full audit retains **7 high / 2 moderate** development
and build advisories. The final Phase 9 database run passed all **14 tests**,
including four full remediation/recurrence journeys, the deny-all bad fix,
injected runner failure with zero remaining execution reservations, RLS and
capability authority. All **162 legacy database tests** and **23 release database
tests** also passed. Combined: **1,103 unique tests passed**, zero failures,
cancellations or skips in the accepted runs. Focused reruns overlap this total
and are not counted twice. Final type-check, production build and
`git diff --check` passed; lint has zero errors and the one existing warning.
No remote CI result is claimed.

Validation findings: an absent-record JSON shape was corrected; the gate now
recognizes the exact active passing replay without prematurely resolving a
finding. The adjacent quota concurrency replay caught a barrier-placement bug in
the proposed patch; the registered transformation now fixes both admission and
barrier placement. Competing broad tests/build/database rehearsals caused strict
runner/browser timeouts; application concurrency is now four files and database
concurrency one, without weakening timeouts or assertions. Interruption also
exposed a reservation-cleanup gap; scoped abandonment now uses existing durable
recovery and cleanup before workspace disposal. The final Phase 9 and legacy
database rehearsals verified these repairs with no failures or skipped tests.
The first final release-suite run passed 22/23 tests, then Windows Modern Standby
interrupted the last journey (confirmed by Kernel-Power standby/resume events).
Its execution grant expired and was rejected by the existing scope validation.
Another interrupted rerun passed 17/23 and failed six dependent checks after
large wall-clock gaps. A subsequent run requested temporary process-scoped
Windows wakefulness, without changing persistent power settings, authorization
expiry or assertions. Only a complete uninterrupted passing run counts toward
the acceptance total. That final run passed all 23 release tests; the temporary
awake request was released when its process finished.

An interrupted run left only
`launchgate-remediation-4d6bd4ec-7180-4410-8b22-3d196f2ca540`, with its exclusively
attached anonymous volume
`a1d509e3abbccf0f8f88c50cb462ad9e07ed2f079a8fd2d6e741b73bc77e7123`.
Disposable/Phase 9 labels, the pinned test PostgreSQL image and exclusive volume
attachment were verified before removing that exact stopped container and volume.
The two older October 11 repository-copy directories were left untouched.
Final inventory on 2026-10-16 found no LaunchGate-named containers, no containers
with the LaunchGate disposable label, and no Phase 9 temporary workspaces. All
database suites' scoped container/volume cleanup hooks passed. Only
`launchgate-ci-xp55exvq` and `launchgate-noenv-8u6xljrw`, the previously recorded
October 11 directories, remained; neither was modified or deleted.

Final Git state: branch `launchgate-rebuild`, HEAD `53ef4c7`; `main` remains
`a61ba8c` and `startupxai-final` remains `a11b1de`. There are 11 modified tracked
files and 26 new files, all unstaged. No commit, push or history change occurred.

Phase 9 acceptance evidence:

| Criterion | Controlled implementation / evidence |
| --- | --- |
| Explicit permission | Separate audited generation and PR actions; OWNER/ADMIN only; finding discovery cannot create a PR |
| Optional scoped write authority | Separate App and selected numeric repository capability; expiration/revocation; analysis permissions unchanged |
| Exact source binding | Vulnerable revision, context/plan hashes, original blobs and exact hunk matching; stale proposals rejected |
| Bounded safe patch | Four files, 160 changed lines, 32 KiB diff; source-only workspace; syntax/provenance checks and exact registered transformation |
| Malicious input | Traversal, secret/code injection, unsupported paths, test/oracle weakening and broad-denial attempts rejected |
| Human release decision | Draft/local PR remains pending; no merge, force push or production deployment |
| Exact verification | Original plan and oracle, positive controls and mandatory adjacent regressions; distinct source/deployment identity |
| Verified evidence | Durable gate and sealed results checked independently; workspace cleanup precedes VERIFIED persistence |
| Resolution and recurrence | PR alone cannot resolve; successful exact verification resolves while retaining native regression; reintroduction reopens |
| Trust boundary | Six forced-RLS tables, cross-org isolation, browser/service forgery denial, immutable proof and scoped dispatch |
| Four remediation journeys | Tenant read, owner role, duplicate webhook and concurrent quota each passed generation through verification and recurrence |
| Bad fix | Deny-all business operations failed positive controls and remained INCONCLUSIVE |
| Failure cleanup | Injected runner disconnect left execution budget active/reserved at zero; scoped durable cleanup completed |
| StartupX coexistence | Existing application assertions pass; no StartupX product feature changed |
| Live providers | GitHub adapter/capability contracts pass; live PR, customer preview and model generation remain UNVERIFIED |

See [remediation](remediation.md), [fix PRs](fix-prs.md), and
[fix verification](fix-verification.md). No auto-merge, production deployment,
public badge, UI redesign, arbitrary customer execution or Phase 10 work.

## Phase 10 - production boundary and operational readiness (2026-10-17; combined database validation accepted)

Baseline: committed Phase 9 `863ac0c` on `launchgate-rebuild`, clean tree. The user
explicitly selected local readiness testing without dedicated staging assets or
provider budget. No live credentials were used, no production target was probed,
and no cloud sandbox, payment, PR or AI diagnostic was created.

Implemented: replaceable sandbox lifecycle contract and existing-orchestrator
adapter; strict egress/filesystem policy; scoped credential broker; versioned
managed-secret interface with encrypted in-memory test implementation; private
object storage adapter; signing rotation; environment/configuration validation;
truthful capability registry; safe observability; bounded retries/circuit;
supervisor and durable cleanup reaper. Migration 032 adds forced-RLS operational
resource metadata, immutable qualifications and safe audit events. Earlier
migrations are unchanged. Local Reference Lab is refused in production/staging.

Focused validation: **59 Phase 10 application tests** plus the existing
orchestration tests and new rotating-signer test passed (63 unique focused tests).
**8 new PostgreSQL tests passed**, including forced RLS, scope/idempotency,
trusted-only qualification, restart/fence recovery, budget release and local
logical backup/restore. LOCAL_RESTORE_VERIFIED; HOSTED_RESTORE_UNVERIFIED.
The artifact-retention/cleanup refinement also passed a final eight-test database
rerun. The final application run passed **964 tests**, zero failures/skips.
The complete database run passed 205/207: all eight Phase 10, 23 release and 14
remediation tests passed; a legacy browser baseline was INCONCLUSIVE rather than
PASS, causing its dependent evidence-count assertion to fail as well. The legacy
162-test suite subsequently passed in isolation, including browser.release and
sealed evidence, without changing assertions or limits (162 passed, zero skipped).
Those initial runs covered **207 database tests** and **964 application tests**, or
**1,171 unique tests**. The initial combined database command was not a clean pass;
the isolated rerun does not establish combined-suite repeatability or resolve the
original failures. Database acceptance was reopened for two clean full runs
and a supported failure classification; the completed review below records the
root cause, fix, and both post-fix passes. The final production build passed.
Final boundary refinements register artifact retention before upload, preserve
cleanup after authorization revocation, bound provider calls, reject nonfinite
rotation overlap, and append DEGRADED status on sandbox/credential/artifact
failures. Trusted qualification reads enforce tenant/environment binding and are
reloaded before dispatch/delivery. These refinements passed focused tests and the
final 964-test application run without weakening existing assurance checks.

Install completed without dependencies/lock changes. Type-check passed; lint has
zero errors and the existing unused `describe` warning. Audit: production zero
vulnerabilities; full tree seven high/two moderate existing development/build
advisories. No forced upgrade or lifecycle-script approval was performed.

| Production-sensitive capability | Current status |
| --- | --- |
| Production sandbox / OS boundary qualification | BLOCKED_BY_ENVIRONMENT |
| GitHub live E2E | UNVERIFIED |
| Vercel live E2E | UNVERIFIED |
| Supabase hosted validation / hosted restore | UNVERIFIED |
| Stripe test API | UNVERIFIED |
| Razorpay test API | UNVERIFIED |
| OpenAI live diagnostic | UNVERIFIED |
| Anthropic live diagnostic | UNVERIFIED |
| Managed secret backend / upstream credential rotation | UNVERIFIED |
| Private cloud object storage / URL invalidation | UNVERIFIED |
| Full controlled staging E2E | UNVERIFIED |
| Sandbox / managed-secret / object-store cloud transports | NOT_IMPLEMENTED |

Implementation acceptance checklist (local evidence only):

| Requirement | Evidence / result |
| --- | --- |
| Replaceable production runner boundary | Complete lifecycle interface and existing RunnerProvider/Orchestrator adapter; no arbitrary commands |
| No silent local production provider | Production factory and local-worker entry reject invalid modes; managed dependencies required |
| Scoped credentials and rotation | Audience/scope/TTL/revocation tests, forbidden control-plane purposes, bounded key overlap and rotating orchestrator signer |
| Explicit network/filesystem policy | IPv4/IPv6/private/metadata/host/port/path denial tests; OS enforcement remains unqualified |
| Secret/artifact abstractions | Managed interfaces, encrypted test secrets, private scoped object keys, hashes, retention and cleanup intent |
| Failure cannot produce PASS | Provisioning-stage failures, hung calls, missing runners, ceilings, revocation and storage failure tests |
| Truthful readiness | Fresh live proof required; synthetic/stale/degraded/missing records cannot approve; tenant-bound trusted reads |
| Retries and degradation | Idempotency-only retries, bounded timeout/backoff/circuit, automatic DEGRADED records |
| Durable cleanup and restart | Resource intent, cleanup fencing, restart simulation, failed cleanup retained, native budget recovery |
| RLS and trust | Three new forced-RLS tables; browser mutation/service RPC denial; immutable qualification/audit history |
| Environment separation | Scope/environment checks and separate managed dependency requirements; cloud separation UNVERIFIED |
| Runtime dependencies | Production npm audit zero vulnerabilities; existing dev/build advisories documented |
| StartupX coexistence | Final 966 application tests pass; no StartupX feature removed |
| Backup/restore | Isolated local logical restore verified; hosted recovery UNVERIFIED |
| Resource inventory | Final baseline comparison passed; no LaunchGate containers or new temporary resources remain |

Final resource checks: both the disposable-label and LaunchGate-name container
inventories are empty. The pre-existing October 11 temporary directories
`launchgate-ci-xp55exvq` and `launchgate-noenv-8u6xljrw` remain untouched, as do
baseline logs. No unrelated resource was removed. Test cleanup removed owned
containers and the Phase 10 harness verified its owned anonymous volumes.

Final Git state: `launchgate-rebuild`, HEAD `863ac0c`; main and archive refs
unchanged. Eleven tracked files modified and 27 new files, all unstaged; no commit or
push. `git diff --check` passed. Combined database acceptance is complete;
production readiness remains false pending real managed providers and live proof.

No production-readiness claim. Provider infrastructure enforcement, measured
attestation, cost/region/concurrency limits and hosted observability require a
selected provider and dedicated account. Local Docker proves database behavior,
not production sandbox security. Existing analysis remains non-executing; no
arbitrary customer scripts, public badge, polished UI or Phase 11 work.

See [production runner](production-runner.md), [integration qualification](integration-qualification.md),
[readiness](production-readiness.md), [operations](operations.md),
[rotation](key-rotation.md), and [recovery](recovery.md).

### Phase 10 combined database validation review

The earlier isolated legacy rerun is not sufficient to close the combined-suite
failures. Original log: `phase10-database.log`, created 2026-10-16 11:47:08 UTC,
completed 12:24:46 UTC; 207 tests, 205 passed, two failed.

| Original order | File / test | Failure |
| --- | --- | --- |
| 201 (legacy test 156) | `tests/database/launchgate-rls.test.ts:670`, Phase 7 durable AI/browser journey browser.release: reproduce, find, fixed replay, regression | Fixed baseline evaluation was INCONCLUSIVE; assertion required PASS |
| 207 (legacy test 162) | `tests/database/launchgate-rls.test.ts:688`, Phase 7 AI/provider/browser observations are sealed, synthetic and zero spend | `lg_reproduction_bundles` count was 13; assertion required 16 |

Both ran after all eight Phase 10 tests. File order was production (8), release
(23), remediation (14), legacy RLS (162), with file concurrency one. Each file
creates a distinct UUID-named disposable PostgreSQL container and database
`launchgate_test`; only the legacy file starts PostgREST, sharing that container's
network namespace. The original legacy container UUID is not present in retained
test logs and cannot be recovered from the removed container; it must not be
invented. The name pattern is `launchgate-rls-<UUID>` and its PostgREST sibling
`launchgate-rls-<UUID>-rest`.

The legacy file deliberately tests progressive upgrades from 001 through 023;
the browser tests run after 023, using execution tables/commands (018/019),
dynamic evidence and reproduction tables/commands (020/021), and the browser
lab extension (023). The three newer files independently apply 001 through 032
in lexical/numeric order before their tests. Applying 032 ahead of the legacy
upgrade assertions would invalidate their historical table-count assertions;
these checks are preserved. The release file also tests browser execution with
the full 032 schema. No database is manually preseeded or reused across files.

The count failure is downstream of the baseline assertion: six AI journeys
produce 12 bundles and the inconclusive browser baseline produces one; aborting
that test prevents its vulnerable/replay/recurrence runs from adding three more.
The original log retains no browser trace or underlying Playwright error, so it
does not prove the cause of INCONCLUSIVE. No timeout, sleep, host suspension,
resource contention, migration collision or connection leak is claimed as fact.
The repeatability investigation and cleanup results follow.

The first repeatability attempt (`phase10-combined-run1.log`) was interrupted at
2026-10-16 17:28:33 UTC before completion. Windows System event 1074 records a
user-session power-off request at 22:58:44 IST, followed by event 42 at 22:58:48.
The next session found Docker stopped. This incomplete attempt is not counted as
a pass and does not explain the original 12:24 UTC assertion failure.
The interrupted run's recorded, labelled PostgreSQL/PostgREST pair was
`launchgate-rls-64e79773-0f73-4b06-bbe0-a7b030c4afac` and its `-rest` sibling.
The attached volume was
`f6c6b7a1027bd9e01c6aea253d02bc526647792a4bb05fc3d5b35e928709aa23`.
Its newly created temp directories were `launchgate-billing-ShPa0s` (synthetic
SQLite fixture files) and empty `launchgate-phase6-Kx5cDo`; timestamps match the
interrupted billing journey. Ownership was checked before cleanup. A combined
recursive cleanup command was policy-rejected; narrower literal container and
file removals succeeded without recursive deletion. Containers/volumes were
empty and the original temp baseline matched before restarting validation on
October 17. The two October 11 directories were untouched.

Fresh full run #1 (`phase10-combined-fresh-1.log`) ran October 17 from 04:17:01
to 04:56:01 UTC: **207/207 passed**, zero failures, cancellations or skips;
2,337,075 ms. Both original failing assertions passed in their original order.
No source/test/migration changes, selective skips, reordered tests or changed
limits were used. `LAUNCHGATE_REQUIRE_DATABASE=1` made Docker mandatory and
`DEBUG=pw:api` added browser diagnostics. A process-local Windows execution-state
request prevented idle suspension while validating; no persistent power setting
was changed, and deliberate shutdown remains possible.
The PostgreSQL identities were `launchgate-production-a64e61f0-7e18-4117-a905-feac18f11e9b`,
`launchgate-release-bc254a9f-f8cc-4912-a1d5-f053d705053a`,
`launchgate-remediation-384c6675-b8f3-42c9-b115-2a578bbc0dea`, and
`launchgate-rls-e2ed0798-37db-4662-a7e7-954bbc2decb0` (plus its `-rest` sibling).
After completion Docker listed zero containers and zero volumes; the temp
baseline check passed before full run #2 started.

Pre-fix full run #2 (`phase10-combined-fresh-2.log`) ran 04:56:05–05:34:27 UTC:
**206/207 passed**. The same browser journey returned INCONCLUSIVE during its
vulnerable recurrence (`launchgate-rls.test.ts:676`, expected REPRODUCIBLE_FAILURE).
The final bundle count passed because all four browser runs had been created.
Cleanup again reported zero containers/volumes and no new temp resources.

The diagnostic log identifies the faulty wait: at 05:34:11.591 UTC,
`locator.click` started, completed the physical click at 11.954, then waited for
navigation. At 13.141 it failed under the 1500ms action timeout. The authorized
route reached `route.fetch` only at 13.149, after context cleanup had begun.
The separately registered navigation wait allowed 5000ms but could not prevent
the shorter, redundant click wait from rejecting Promise.all. This is a browser
collector timing bug, not evidence of a schema collision or shared PostgREST.
[Playwright's click contract](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locator.md?plain=1)
explicitly includes navigation in the action timeout unless `noWaitAfter` is set.

A targeted regression injects 1800ms into the control form's request authorization:
the original collector failed with UNOBSERVABLE instead of COMPLETED. Setting
`noWaitAfter:true` on click leaves the existing explicit 5000ms navigation wait
responsible for navigation and preserves the 1500ms action limit. No sleep,
timeout, journey budget or assertion was relaxed. The regression then passed;
a 5500ms authorization delay still failed safely and cleaned up. Both regression
tests plus all seven existing browser safety tests passed (9/9). Application test
count increases from 964 to 966 solely for these two new regression cases;
the combined database test count remains 207. Final post-fix full-suite validation
is complete below; pre-fix passing runs are not substituted for it.

Post-fix validation: type-check passed; lint passed with only the existing unused
`describe` warning; all **966 application tests passed**, zero skipped; production
build passed. These workloads finished before database validation restarted.
Post-fix full database run #1 (`phase10-navigation-db-1.log`) ran October 17,
11:42:05–12:20:57 UTC: **207/207 passed**, zero failures/cancellations/skips,
2,329,869 ms. Its disposable containers were production
`9d9e6d3c-b278-4b92-a78b-ad7780eb4360`, release
`1d64a7e9-24ee-4867-a3c4-ca63f4da0bd5`, remediation
`a8e6fd85-75a8-4c9a-903a-18e47b7d0007`, and legacy RLS
`4cad2907-35af-46bb-999b-ecf3f4cac924` (standard `launchgate-<suite>-` prefixes,
plus the RLS `-rest` sibling). Lifecycle events record their destruction.
The between-run check found zero containers, zero volumes, and no new temp
resources. Post-fix full run #2 (`phase10-navigation-db-2.log`) ran from 12:21:01
to 13:00:19 UTC from scratch: **207/207 passed**, zero failures/cancellations/skips,
2,355,842 ms. Its disposable containers were production
`34ae84d5-efcd-46b6-bf9f-dbff388689f2`, release
`5f4c61ad-3149-4682-8652-bcf1f85da666`, remediation
`ee4de327-5a81-4865-b52a-8fff7f00b27f`, and legacy RLS
`c908c6f2-5e53-4202-a80a-799783356270` (same prefixes and `-rest` convention).
Lifecycle records confirm destruction of all five. The final check again found
zero containers, zero volumes, and no new temporary resources. No managed or
external credential lease was issued by these local database runs. Their
ephemeral signing keys are process-local, budget-release assertions passed, and
destroying each owned database removed its remaining test-only lease/reservation
records. No unrelated resource or the two pre-existing temp directories changed.

Classification: **RESOLVED_ROOT_CAUSE**. The retained original log cannot prove
its exact low-level browser exception, but the full-suite recurrence captured
the duplicate-wait timeout and the controlled regression reproduced that bug
before the fix and passed afterward. The original bundle-count discrepancy is
the consequence of aborting the browser journey early. No schema contamination,
shared PostgREST state, identifier collision or leaked connection was demonstrated.

Final database verdict: **PASS**. Two consecutive post-fix complete runs passed;
the accepted final application/database coverage is **1,173 unique tests**
(966 + 207), without counting repeated runs twice. Review changes are confined
to `reference-lab/browser/collector.ts`, the two-case regression file
`tests/launchgate-browser-navigation.test.ts`, and this ledger. No migration,
database test assertion, test ordering, timeout or production functionality was
changed. No commit, push, main/archive modification or Phase 11 work.

## Phase 11 — customer product UI (18 October 2026)

Status: **LOCAL VALIDATION PASS — ready for review; one manual cleanup item remains**.
Work remains uncommitted on `launchgate-rebuild`; main and startupxai-final are
unchanged. No Phase 12 implementation, public badge, commercial billing,
automatic merge, or production target execution is included.

The route/data review and operator instructions are in `product-ui.md`.
LaunchGate now owns `/`; StartupX's original homepage is preserved at `/startupx`,
with its existing app/authentication routes retained. LaunchGate's `/app` shell
provides real organization/project onboarding, repository/source discovery,
invariant confirmation, runs, releases, findings/evidence, remediation,
regressions, policies, integrations, team, audit and settings surfaces.

The UI uses caller-authenticated APIs and bounded tenant-scoped read models.
Secret fields and internal artifact locators are excluded. Finding labels match
the recorded invariant version; composite-key lists have deterministic ordering.
SHIP expiry becomes STALE; waivers never rewrite evidence outcomes. Static
architecture detection is distinct from dynamic proof. Missing, stale or
inconclusive assurance never becomes approval.

The isolated Reference Lab is a separate immutable project purpose (migration
033), with durable confirmation, execution requests, fenced claims and real
release evidence. It cannot acquire customer repository connections. The local
operator uses existing orchestrator/release/remediation workers and real HTTP
fixtures. Fixture PRs and previews are explicitly labeled; no GitHub or hosted
provider success is fabricated.

### Validation evidence

- Application suite: **989/989 PASS**, zero skips, including 23 focused Phase 11
  UI/API/presentation tests. Legacy homepage tests now target the preserved
  StartupX route; their assertions remain intact.
- Product browser journey: passed onboarding → reproduced finding → BLOCK →
  proposal → validation → explicit fixture PR → verified replay → SHIP.
  Mobile navigation, native dialog focus/Tab/Escape restoration, signed-out
  access, HTML secret exclusion and VIEWER read/administrative-denial checks pass.
- Captures: seven pages at 1440, 1280, 768 and 390 pixels (28 screenshots), with
  programmatic page-overflow checks and visual review sheets. Screenshots are
  under `.launchgate/phase11-qa`; the Next development indicator is test tooling.
- Type-check: PASS. Lint: zero errors, one pre-existing unused `describe` warning
  in `tests/public-source.test.ts`.
- Production build: PASS. Homepage first load 108 kB; authenticated shell 187 kB (103 kB shared).
- Dependency audit: production **0 vulnerabilities**; full tree **7 high and
  2 moderate**, pre-existing development/build dependencies. No dependency update
  or script approval is introduced by this phase.
- Full database suite: **214/214 PASS**, zero failures or skips, in 2,331,327 ms
  (38 minutes 51 seconds). This is the complete combined run from fresh disposable
  databases: 207 existing plus seven Phase 11 tests.

### Database investigation

The first attempt was 209/214. One new test incorrectly expected textual `null`
for SQL NULL in `psql -At`; its assertion now expects the empty output. A genuine
pre-existing remediation permission bug sampled `clock_timestamp()` twice and
exceeded the strict one-hour expiry bound by one microsecond. Forward migration
034 samples once; the existing test now asserts an exact one-hour lifetime.
No authorization constraint or execution timeout was weakened.

The other initial failures coincided with recorded Windows Modern Standby.
A second attempt was 208/214 after a lid-triggered suspension lasting several
hours and later idle suspension. Migration 034's regression passed in that run;
long-running execution cases and their dependent evidence counts did not.
Retained logs are `phase11-database.log`, `phase11-database-standby-run2.log` and
`phase11-environment-evidence*.log`. These attempts are not accepted as green.
A fresh full attempt is recorded in `phase11-database-final.log`.

### Capability and cleanup limits

Hosted capabilities remain UNVERIFIED and Production Sandbox remains BLOCKED BY
ENVIRONMENT in this unqualified local setup. GitHub's existing setup contract
requires installation/repository IDs; source processing requires its operator
worker. Customer policy activation requires registered plans. Team access uses
existing account IDs; email invitations are unsupported. Read views and filters
have explicit bounded scopes. Evidence is a redacted, bounded presentation.

The successful product browser test asserted zero active/reserved execution
budget and zero live credential resources before destroying its database.
Its named containers, anonymous volume and temporary artifacts were removed.
An older interrupted run left the owned directory
`C:\Users\Punith\AppData\Local\Temp\launchgate-phase11-artifacts-cUwgyN`.
Automatic approval review blocked recursive deletion; its two named containers
were removed separately. This one directory remains a manual cleanup item:

```powershell
Remove-Item -LiteralPath 'C:\Users\Punith\AppData\Local\Temp\launchgate-phase11-artifacts-cUwgyN' -Recurse -Force
```

The temporary legacy-homepage backup was content verified against HEAD and
removed; the actual StartupX source remains preserved. Unrelated pre-existing
temporary directories were not touched. Final resource inventory is recorded below; manual cleanup remains explicitly outstanding.

Final review on 19 October 2026: Docker inventory contains **zero containers and
zero volumes**. Temporary directory inventory contains only the two unrelated
pre-existing directories (`launchgate-ci-xp55exvq`, `launchgate-noenv-8u6xljrw`)
and the single explicitly recorded manual cleanup item above. No new test
artifact directory remains. No external credential lease or provider spend was
used. The successful full suite and browser harness completed their owned
resource cleanup. No Windows script-policy or power-plan setting was changed.

`git diff --check` passes. The working tree has 10 modified tracked files and
40 new files, all uncommitted. HEAD remains
`53aa442544fa81914418428c8a8192e00d349fe5`; protected refs remain
main `a61ba8c8873fa0eedf48879f90aa4869f8991b8f` and startupxai-final
`a11b1de6a36dddc535745aa24e006008e9fa4c20`. No push occurred.

Local functional/test acceptance: **PASS**. Cleanup status:
**MANUAL_ACTION_REQUIRED** for the one old directory; this is not described as
a leak-free completion. Hosted operational qualification remains outside this
local validation and is visibly unverified. Phase 12 has not started.

## Phase 12 implementation checkpoint — 19 October 2026

Phase 11 is now committed by the user at `f5896e2`; Phase 12 began from a clean
`launchgate-rebuild` working tree. This section supersedes only the earlier
statement that Phase 12 had not started. **Phase 12 acceptance is NOT complete.**

Implemented so far: independently buildable `@launchgate/cli`, Phase 3 parser
reuse, bounded non-executing local inspection, explicit static checks, offline
preflight, strict data-only initialization, versioned JSON, safe project URL
output, and an authenticated existing-release read/check path. Remote projections
use existing principal/membership/RLS controls, current evaluation generation,
release state and evidence expiry. No migration or new database authority exists.
The CLI documentation identifies unsupported commands and unfinished auth/CI work.

Validation at this checkpoint: 20/20 CLI tests and 996/996 application tests
(989 existing plus seven distribution-read tests), with zero skips. The seven
focused API reruns are the same tests, not additional unique coverage. CLI build,
typecheck, lint and production build pass; lint retains the pre-existing unused
`describe` warning in `tests/public-source.test.ts`. Production audit: zero
vulnerabilities. Full audit: seven high and two moderate development/build
advisories. No new third-party dependency version was introduced; the CLI uses
the existing parser's pinned TypeScript 5.9.3. Local logs use `phase12-*.log`;
audit reports are ignored under `.launchgate/phase12`.

Outstanding acceptance work: completed CLI login/session storage and history/wait
commands; scoped CI credentials; GitHub Action; App onboarding improvements;
public assessment with durable abuse controls/cache; sharing/revocation; public
assurance and badge freshness; required UI/docs/telemetry; security/RLS tests;
controlled distribution demo; complete fresh database suite. No Phase 12 database
run has been performed. Prior Phase 11 DB results are not Phase 12 validation.

No Phase 12 test temporary directory, Docker container or volume remains after
the checkpoint tests. The separately documented Phase 11 manual cleanup item
is not claimed resolved. No provider credential lease or budget was used.
No package/Action publication, deployment, commit or push occurred. Protected
branch refs remain unchanged. Continue Phase 12; do not treat this checkpoint as
approval to begin Phase 13.


## Phase 12 final acceptance - reviewed 20 October 2026

**Phase 12 COMPLETE for the requested local implementation and acceptance scope.**
This supersedes the incomplete Phase 12 checkpoint above. It is not a hosted
production-readiness claim. Phase 13 has not started.

Implemented: browser-approved one-day human CLI sessions with origin/state-bound
loopback delivery and user-only credential-file fallback; separate hashed,
project-scoped CI credentials with rotation, expiry, revocation and audit;
authoritative CLI history/check/wait with safe aggregate coverage; exact-SHA
repository-local GitHub Action; GitHub App installation/repository selection;
bounded public static assessment; durable quota, immutable cache and provider
backoff; explicit immutable-evaluation sharing; opt-in public assurance and
freshness-aware SVG badges; setup UI, privacy-conscious telemetry and documentation.

Forward migrations 035 and 036 add distribution identity and public projection
boundaries. Migrations 001-034 are unchanged. New tables force RLS; browser roles
cannot write machine usage, hashes, share contents, badge states or gate decisions.
The privileged gateway permits only the two constrained distribution RPCs.
Organization deletion immediately withdraws public identity and assurance.

### Final validation evidence

| Check | Result | Evidence |
| --- | --- | --- |
| npm install | PASS; existing allow-scripts policy unchanged | phase12-install-final.log |
| CLI independent build / tests | PASS, 26/26 | phase12-cli-build-final.log, phase12-cli-tests-final.log |
| Full application suite | PASS, 1058/1058, no skips | phase12-tests-acceptance.log |
| Full combined database suite | PASS, 237/237, no skips | phase12-database-final.log |
| Distribution contract subset | PASS, 66/66 | phase12-distribution-tests-final.log |
| GitHub onboarding/provider contracts | PASS, included in app total | phase12-github-tests.log |
| Distribution database/RLS subset | PASS, 23/23, included in DB total | phase12-db-distribution-final.log |
| Production-server distribution demo | PASS, real APIs and disposable PostgreSQL/PostgREST | phase12-demo-acceptance.log |
| Typecheck / lint / production build | PASS; one pre-existing unused describe lint warning | phase12-typecheck-acceptance.log, phase12-lint-acceptance.log, phase12-build-acceptance.log |
| Production dependency audit | 0 vulnerabilities | .launchgate/phase12/audit-production-final-2026-10-20.json |
| Full dependency audit | 7 high, 2 moderate development/build advisories | .launchgate/phase12/audit-final-2026-10-20.json |

Counts are unique: 1058 application + 237 database + 26 standalone CLI = 1321
passing automated tests, plus the controlled browser demo. The 66 distribution
contracts (19 Action, 21 assessment, 19 public share/badge/security, seven legacy
distribution reads) are included in 1058, not additional tests. The database count
is the existing 214 plus 23 distribution tests. The final complete command used
fresh disposable databases, all current migrations 001-036 in order in current-
schema harnesses, and the preserved staged legacy migration-upgrade rehearsal.
No reused database or selectively skipped tests substituted for this combined run.
The earlier 231/231 combined run preceded six additional security tests and final
SQL refinements; the final 237/237 result validates those refinements as well.

The demo proves actual browser CLI authorization and logout, static-only fixture
inspection, confirmed Reference Lab verification, reproduced BLOCK, constrained
fix/replay and SHIP, sanitized historical sharing, expiry/revocation, public
VERIFIED, policy/superseding-release STALE and restored VERIFIED. It verifies zero
active execution reservations and credential leases before teardown. Twenty-eight
existing responsive screenshots plus four distribution screenshots are retained
as intentional review artifacts under .launchgate/phase12-qa. Desktop assessment,
desktop sharing and mobile assurance were visually reviewed.

Failures encountered were corrected rather than hidden: the original privileged
client placement violated the existing trust-boundary test and was moved into a
restricted RPC gateway without weakening that test; browser CLI delivery needed a
loopback connect-src allowance restricted to /app/cli; a visual selector's em dash
was corrupted by the shell and was encoded explicitly. A development-server run
returned internal JSON parse errors during navigation. Acceptance now builds and
serves immutable production output instead of depending on hot compilation. That
exposed a test navigation race: both old and new pages had an organization field;
the test now waits for the onboarding URL before entering data. No assertions
were weakened, sleeps increased or retries added to hide these failures.

### Acceptance and limits

CLI, Action, public assessment, sharing, badge freshness, scoped CI credentials,
public endpoint security, RLS, UI and required validation: **PASS**. Static results
cannot become dynamic assurance. CI cannot administer organizations, create public
shares or authorize remediation. The Action reconciles candidates from the existing
connected pipeline; a missing candidate remains INCONCLUSIVE. Normal checks need
no repository write permission. CI's external actions are pinned to immutable,
verified Node 24 upstream revisions; hosted execution is not claimed qualified.

Native keychain providers are not bundled: the documented owner-only file fallback
is used. Windows was exercised locally; macOS/Linux end-to-end OS qualification
remains external. Live GitHub/provider integrations, proxy configuration and access-
log redaction need operational qualification. Detailed finding sharing and optional
CLI share creation are not exposed; human web sharing is implemented. Known dev
advisories remain recorded. No commercial billing, publication or deployment occurred.

### Cleanup and Git verification

On final review, Docker was restarted solely to inspect cleanup: **zero containers
and zero volumes**. No new LaunchGate temporary directories remain. The two unrelated
pre-existing directories launchgate-ci-xp55exvq and launchgate-noenv-8u6xljrw were
untouched. The previously documented Phase 11 directory
C:\Users\Punith\AppData\Local\Temp\launchgate-phase11-artifacts-cUwgyN
is now absent; this continuation did not remove it or bypass the prior rejection.
Browser contexts and test servers are closed. No live provider spend or credentials
were used. Logs, builds and screenshots are intentional ignored review artifacts.

StartupX remains intact, including its original /share/[token] page; LaunchGate
sharing uses /assurance/share/[token]. The full app regression suite passes.
Branch remains launchgate-rebuild at f5896e2. No staged changes, commit or push.
Protected refs remain main a61ba8c8873fa0eedf48879f90aa4869f8991b8f and
startupxai-final a11b1de6a36dddc535745aa24e006008e9fa4c20.
The working tree contains 19 modified tracked files and 43 new files.
Final git diff --check passes. Phase 13 requires a separate user instruction.


## Phase 13 - dedicated staging qualification (2026-10-20)

### Scope and availability

User authorized Phase 13 on launchgate-rebuild after committing Phase 12 at
`d2d82e5c7486f63d167eb421b27d8c58a13c4df8`. No commit, push, deployment,
publication, paid provisioning or Phase 14 work occurred.

Initial safe inventory: GitHub analysis/remediation App and webhook, Vercel,
Stripe, OpenAI, managed artifact/secret/sandbox selectors and staging selectors
MISSING. Supabase, Razorpay and Anthropic values PLACEHOLDER. No dedicated approved
repository, deployment, hosted database or provider account/budget was available.
No secret values were printed. Existing local registry supplied no live evidence.

The safe qualification command persisted local timestamped reports under ignored
`.launchgate/phase13/`; the unavailable hosted registry was not written. Nineteen
capabilities are BLOCKED_BY_ENVIRONMENT; optional GitHub remediation is UNVERIFIED.
All live qualifications, Windows CLI against staging, actual hosted Action,
external assessment/share/badge, deployment/recovery and full E2E remain unavailable.
macOS/Linux CLI remains UNVERIFIED. No live request or provider spend occurred.
OpenAI spend $0.00; Anthropic spend $0.00; financial live spend $0.00.

### Implemented and reviewed

Twenty capability evidence checklists, strict dedicated-staging manifest,
configuration/credential/permission/version binding, contract-only admission
refusal, cleanup-gated qualification, one-hour expiry, safe reason codes and
truthful UI freshness are implemented. Migration 037 adds forced-RLS configuration
bindings and immutable diagnostic reservations. Trusted service operations alone
can write; browser mutation and old-RPC bypass are denied. Runtime credential
changes invalidate prior verification without exposing credential values.

AI reservations enforce a durable global Phase 13 ceiling of $0.10 per provider
within the authoritative staging ledger before driver execution. Duplicate tickets,
production diagnostics, invalid amounts and exhausted budgets are denied; unknown
outcomes are not refunded. Drivers must additionally prove a current worst-case
request/pricing bound. No live pricing or diagnostic driver was exercised.

No concrete live qualification drivers are registered by the command. With approved
assets but no driver, status is NOT_IMPLEMENTED. The local framework and contracts
must not be described as working hosted integrations. External revocation requires
webhook/operator invalidation; arbitrary provider permission polling is not claimed.

Security review/regressions cover missing approvals, strict metadata-only manifests,
origin restrictions, malformed URLs, cross-tenant/project/config observation
rejection, contract evidence refusal, redacted provider errors, cleanup failure,
credential rotation, budget admission, forced RLS and old service bypass. Existing
OAuth/webhook/SSRF/CI/share/badge/target/egress contracts run in the full app suite.
Managed sandbox escape and real egress controls remain unqualified without a provider.

See [staging setup](staging.md), [live matrix](live-qualification-matrix.md),
[readiness policy](production-readiness.md), operations and recovery docs.
Minimum live requirements include GitHub, Checks, Vercel, hosted DB, managed
storage/secrets, production sandbox, staging deployment/E2E/recovery/cleanup.
Payment/AI qualifications are additional requirements for dependent enabled features.

### Validation and failure accounting

- npm.cmd install: completed; lockfile unchanged. npm reported unapproved install
  scripts for esbuild/unrs-resolver; existing installed tooling built/tested successfully.
- Type-check: PASS. Lint: PASS, zero errors; one pre-existing unused describe warning
  in tests/public-source.test.ts.
- Full app suite final: **1092/1092 PASS**, zero skips (1058 baseline + 34 new tests).
  The initial run was 1090/1092: browser.signup vulnerable and navigation 1800ms
  failed at about 15,049ms, health false, before fixture interaction, matching the
  unchanged Chromium launch timeout. Database work was concurrent. No assertion,
  timeout or test ordering was changed. After DB/build completed, the entire same
  app command passed. This supports launch/resource contention as an explanation;
  no browser root cause beyond the observed pre-fixture launch failure is claimed.
- Qualification-focused suite: **34/34 PASS**.
- Full combined DB suite: **243/243 PASS**, zero skips, 2,426,078ms. Count is 237
  baseline + six Phase 13 DB tests. Fresh owned disposable environments were used;
  current-schema harnesses applied migrations 001 through 037 in filename order.
  The legacy RLS suite retains its staged historical upgrade rehearsal. This is
  full combined acceptance, not an isolated rerun.
- A focused DB attempt initially failed in its before hook: the production harness
  used socket pg_isready, which accepted the image's temporary initialization
  server before it shut down. Bootstrap then found no PostgreSQL socket. Changed
  only readiness to TCP 127.0.0.1, matching the other harnesses; no sleeps increased.
  The corrected production/qualification tests passed inside the full combined run.
- Production build: PASS, all 65 static pages generated. CLI build PASS;
  Windows local CLI suite **26/26 PASS**. Integration contracts included in full app.
- npm audit --omit=dev: **0 vulnerabilities**. Full npm audit: **7 high, 2 moderate**
  development-tool advisories, unchanged from Phase 12. Breaking dependency upgrades
  were not applied. Full audit is not described as clean.

Review logs are ignored phase13-*.log files. StartupX routes and regression tests
remain intact, including original /share/[token]; no StartupX production asset was
used. No live integration result was inferred from local synthetic fixtures.

### Cleanup and Git

Final inventory: **zero Docker containers, zero volumes**, no new LaunchGate temp
directories. Pre-existing launchgate-ci-xp55exvq and launchgate-noenv-8u6xljrw were
untouched. Database fixture identities, leases and diagnostic reservations were
confined to destroyed disposable databases. No external identity, credential lease,
reservation, sandbox or artifact was created. Intentional local qualification
reports/builds/logs remain ignored review artifacts, not orphaned resources.
Resource-inventory check passed.

Branch and HEAD unchanged: launchgate-rebuild / d2d82e5. Protected refs unchanged:
main a61ba8c8873fa0eedf48879f90aa4869f8991b8f;
startupxai-final a11b1de6a36dddc535745aa24e006008e9fa4c20.
No staged changes. Phase 13 changes remain uncommitted for review.

**Verdict:** local qualification framework and required local validation PASS;
external live qualification BLOCKED_BY_ENVIRONMENT. LaunchGate is **not production-ready**.
Phase 14 has not started. Recommended next scope is provision/approve dedicated
staging assets, implement the selected concrete qualification drivers and complete
the documented live matrix before considering production launch.
