# Complete V1 acceptance ledger

Status describes end-to-end V1 capability, not whether a Phase 1 type exists. Initial future criteria remain NOT_IMPLEMENTED. Phase 1 contract tests are partial evidence only. Completion requires recorded CI/integration/artifact evidence, not editing this status column alone.

| ID | Description | Required evidence/test | Planned phase | Status |
| --- | --- | --- | --- | --- |
| BASE-01 | Existing StartupX compiles and tests | Phase 0: 176 tests, typecheck/lint/build passed | 0 | BASELINE_PROVEN |
| LG-01 | Root install/checks/build reproducible in CI | Lockfile install, pinned Node, full CI run | 1, 10 | NOT_IMPLEMENTED |
| LG-02 | No unassessed critical/high dependency exposure | Versioned advisory/path/remediation review; release fixes validated | 1, 10 | NOT_IMPLEMENTED |
| LG-03 | Fresh and upgraded database work | Empty DB and representative StartupX snapshot migration tests | 2 | NOT_IMPLEMENTED |
| LG-04 | All tenant surfaces isolated | Cross-org API/SQL/storage/jobs/streams/CLI/integration tests | 2, 10 | NOT_IMPLEMENTED |
| LG-05 | Member cannot promote itself or authorize targets | Role matrix and direct database/API adversarial tests | 2, 5 | NOT_IMPLEMENTED |
| LG-06 | GitHub connection is least privilege | Install/select/revoke/webhook/permission tests | 3 | NOT_IMPLEMENTED |
| LG-07 | Repository ingestion cannot execute/escape | Hostile archive, symlink, path and install-script corpus | 3–4 | NOT_IMPLEMENTED |
| LG-08 | Architecture discovery is attributable | Source SHA/file/line mapping against supported reference apps | 3 | NOT_IMPLEMENTED |
| LG-09 | Ambiguous invariants require confirmation | Confirmation/version and policy-change browser/API tests | 3 | NOT_IMPLEMENTED |
| LG-10 | Target testing requires current explicit authorization | Challenge/provider ownership, time/revocation, exact scope tests | 4 | NOT_IMPLEMENTED |
| LG-11 | Public repo assessment never authorizes target requests | Network trace and denied dynamic-run tests | 3, 9 | NOT_IMPLEMENTED |
| LG-12 | Synthetic setup and cleanup are bounded | Identity/data provisioning/reset/cleanup fault injection | 4 | NOT_IMPLEMENTED |
| LG-13 | Runner isolation contains hostile code | Escape, metadata, filesystem, IPv4/IPv6, DNS/redirect fixtures | 4 | NOT_IMPLEMENTED |
| LG-14 | Cancellation stops new work and terminates within 10s | Measured revocation/kill drill | 4 | NOT_IMPLEMENTED |
| LG-15 | Retries and duplicates do not duplicate side effects | Worker crash, stale lease, webhook replay and outbox tests | 4, 6, 9 | NOT_IMPLEMENTED |
| LG-16 | Evidence admission authenticates actual execution | Lease/signature/hash/origin tamper tests with stored artifacts | 4 | NOT_IMPLEMENTED |
| LG-17 | Models cannot mint failures, blocks or attestations | Phase 1 negative semantics plus end-to-end prompt injection tests | 1, 3–4, 9 | NOT_IMPLEMENTED |
| LG-18 | Every blocking finding has deterministic reproduction | Original/replay artifacts, controls, matching oracle and scope | 5–8 | NOT_IMPLEMENTED |
| LG-19 | Missing setup/control/credentials/timeouts are inconclusive | Phase 1 semantics plus runner failure scenarios | 1, 4–7 | NOT_IMPLEMENTED |
| LG-20 | Auth/session/recovery boundaries verified | Vulnerable/fixed/inconclusive executable fixtures | 5 | NOT_IMPLEMENTED |
| LG-21 | Tenant/role/ownership/storage invariants verified | Read/write/escalation fixtures across roles and tenants | 5 | NOT_IMPLEMENTED |
| LG-22 | Billing/entitlement lifecycle verified | Stripe AND Razorpay safe-mode success/failure/monthly/yearly/change/cancel/expiry/refund matrix | 6 | NOT_IMPLEMENTED |
| LG-23 | Webhook signature/duplicate/replay/order safety verified | Concurrent/reordered provider test event matrix | 6 | NOT_IMPLEMENTED |
| LG-24 | AI anonymous/paid/quota/cost boundaries verified | OpenAI/Anthropic adapter tests and bounded provider observations | 7 | NOT_IMPLEMENTED |
| LG-25 | Budgets reserved before work under concurrency | Distributed race tests, crash/refund/finalization ledger | 2, 7 | NOT_IMPLEMENTED |
| LG-26 | Critical happy/unhappy browser paths verified | Playwright journeys on vulnerable/fixed revisions | 7 | NOT_IMPLEMENTED |
| LG-27 | Build/configuration/migration safety verified | Disposable DB migration/build/environment fixtures | 7 | NOT_IMPLEMENTED |
| LG-28 | Every major domain has Reference Lab triplets | Executable fixture apps; Phase 1 pure cases are partial evidence | 1, 5–7 | NOT_IMPLEMENTED |
| LG-29 | Fix PRs stay within authorized scope | Patch validation, no merge/workflow privilege, PR tests | 8 | NOT_IMPLEMENTED |
| LG-30 | Exact replay preserves oracle and fixture recipe | Vulnerable → fix build replay; adjacent positive controls | 8 | NOT_IMPLEMENTED |
| LG-31 | Permanent regressions fail before and pass after fix | Same test on original/fixed revisions | 8 | NOT_IMPLEMENTED |
| LG-32 | Commit/deployment A cannot approve or block B | Phase 1 scope tests plus real GitHub/Vercel integration tests | 1, 9 | NOT_IMPLEMENTED |
| LG-33 | Missing coverage cannot become successful required check | Branch protection/check conclusion integration tests | 9 | NOT_IMPLEMENTED |
| LG-34 | Verified badge is scoped, expiring and revocable | Signing, stale candidate, expiry/revocation/publication tests | 9 | NOT_IMPLEMENTED |
| LG-35 | CLI and public assessment operate self-service | Fresh machine local/no-upload and hosted auth/run flows | 9 | NOT_IMPLEMENTED |
| LG-36 | LaunchGate billing manages all paid access paths | Free/Pass/Launch/Pro/Studio purchase/renewal/cancel/refund/dedupe tests | 9 | NOT_IMPLEMENTED |
| LG-37 | Retention/export/deletion is complete | DB/blob/cache/credentials/publication/backups deletion drill | 2, 10 | NOT_IMPLEMENTED |
| LG-38 | Restore meets proposed RPO 24h/RTO 4h | Timed backup recovery exercise | 10 | NOT_IMPLEMENTED |
| LG-39 | Capacity and cost ceilings hold | Load tests, request counts, measured provider spend, fairness | 7, 10 | NOT_IMPLEMENTED |
| LG-40 | UI is accessible and honest | Keyboard/mobile/accessibility review, no fake results or progress | 9–10 | NOT_IMPLEMENTED |
| LG-41 | Full fresh-account loop needs no operator edits | Signup → connect → authorize → find → fix → replay → gate browser recording | 10 | NOT_IMPLEMENTED |
| LG-42 | Live integrations are actually configured | Secure credential restoration and authorized non-destructive smoke tests | 10 | NOT_IMPLEMENTED |

## Phase 1 evidence

`launchgate-env.test.ts` checks configuration states, safe serialization, liveness, verified-principal dependency and API errors. `launchgate-invariant-spec.test.ts` checks strict bounded operations and target authorization structure. `launchgate-gate.test.ts` checks positive controls, reproduction, policy, candidate binding, uncertainty and admission. `launchgate-reference-lab.test.ts` contains pure triplets for all eight initial families. These do not establish any live-provider or executable runner criterion above.
