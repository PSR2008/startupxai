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
