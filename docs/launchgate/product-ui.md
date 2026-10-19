# Phase 11 product route and data map

Baseline: `53aa442`, branch `launchgate-rebuild`. StartupX retains `/dashboard`,
`/signin`, `/signup`, `/onboarding` and its existing application route group.
LaunchGate uses `/app/onboarding` to avoid changing the existing onboarding contract.

| Route | Customer question | Authoritative data / commands |
| --- | --- | --- |
| `/` | What does LaunchGate prove? | Public product explanation; no customer metrics |
| `/startupx` | Legacy product entry | Preserved StartupX homepage |
| `/app/login` | How do I access my workspace? | Existing Supabase password/PKCE authentication |
| `/app` and `/app/projects` | Which projects can I access? | organizations, projects; caller JWT and RLS |
| `/app/onboarding` | What remains to configure? | Durable organization/project, connection, snapshot, confirmation, policy and run records |
| `/app/projects/:id` | Can I ship? | Latest release evaluation, coverage and findings |
| `…/repository` | What source was analyzed? | GitHub setup/connections/repositories, snapshots, architecture |
| `…/invariants` | What must remain true? | Proposals, provenance, confirmations; confirm/refine/defer commands |
| `…/runs[/:run]` | What actually ran? | Verification runs and events; bounded polling and cancellation |
| `…/releases[/:release]` | Why SHIP/BLOCK/INCONCLUSIVE? | Candidates, evaluations, items, policy, exceptions, check publication |
| `…/findings[/:finding]` | What failed reproducibly? | Finding, occurrences, safe evidence, events, regressions |
| `…/remediation/:proposal` | Is the proposed fix verified? | Proposal, validation, patch, preview and verification; separate commands |
| `…/regressions` | Does protection persist? | Permanent regression artifacts |
| `…/settings` | Who controls verification? | Policies, environments, authorizations, retention and durable deletion |
| `/app/integrations` | Which capabilities are qualified? | Phase 10 capability registry; configuration is distinct from qualification |
| `/app/activity`, `/app/team` | What changed and who has access? | Tenant audit/membership APIs and existing roles |
| `/app/reference-lab` | Can I explore controlled proof? | Explicitly isolated Reference Lab records and actual local execution |

## Read-model gaps found before UI implementation

Existing APIs support mutations and individual object reads but omit several list
and related-detail reads. Add bounded, explicitly allowlisted read models with
verified principal, project membership and caller-scoped database access. Never
return secret references, signing material, tokens or internal credential locators.
Existing command handlers remain the authorization authority. UI role checks are
affordances only. Evidence must be redacted before it reaches a client.

## Interaction contract

Each screen has loading, empty, denied/expired, failure and retry states. No empty
result implies safety. Static architecture detection never counts as dynamic proof.
Required coverage uses backend evaluation counts, never an invented score. A waiver
does not convert failure to PASS. A generated patch is unverified until replay.
Production qualification defaults remain UNVERIFIED / BLOCKED BY ENVIRONMENT.

## Visual and validation plan

Scoped LaunchGate styles: warm white, graphite, restrained teal; IBM Plex Sans and
Mono. Shared accessible controls, visible text states, native forms, focused dialogs,
reduced motion, responsive navigation and scroll-contained evidence. Inspect browser
screenshots at 1440, 1280, 768 and 390 pixels. Exercise the real authenticated API
and Reference Lab in a disposable database, without production credentials or auth
bypasses. Record exact validation counts in the acceptance ledger when completed.

## Operating the local demonstration

Apply the ordered migrations, including `033_launchgate_product_lab.sql` and
`034_launchgate_capability_clock.sql`. The latter corrects a pre-existing
remediation capability expiry race: verification and expiry now share one clock
sample while retaining the strict one-hour database constraint.

Use a dedicated local database for the operator worker. Set
`LAUNCHGATE_ENVIRONMENT=test` (or `development`) and
`LAUNCHGATE_REFERENCE_LAB_ENABLED=true`; supply the normal local Supabase endpoint
and server-side service credential through environment configuration. Run
`npm run reference-lab:worker` in a separate operator process. The worker rejects
non-loopback database endpoints. Its existing orchestration queues are shared
within that dedicated database; do not point it at a customer workload database.
Artifacts stay under the ignored `.launchgate/product-lab/artifacts` directory.

In the authenticated app, open Reference Lab, create an isolated lab project,
confirm the invariant and policy, and request verification. Refresh persisted
execution state, inspect the blocked release and reproduced finding, then request
a fix proposal. Validation, PR creation and verification are separate explicit
actions. The local PR/preview is a labeled Reference Lab fixture, not a GitHub PR.
Only the real replay and adjacent regression results permit a SHIP evaluation.

`npm run test:product-ui` provisions its own PostgreSQL/PostgREST, a process-local
test identity provider, real Next routes, and a Chromium session. It requires
Docker and the Playwright Chromium installation, but no external credentials.
It captures seven pages at four widths under `.launchgate/phase11-qa` and removes
its owned containers, anonymous database volume and temporary artifact directory
in `finally`. CI runs this in a separate job and uploads the browser evidence.

## Compatibility and capability limits

The homepage is LaunchGate; the preserved StartupX homepage is `/startupx`.
Existing StartupX authentication/dashboard routes remain. LaunchGate authentication
is under `/app/login`, `/app/signup`, `/app/forgot-password`,
`/app/reset-password` and `/app/auth/callback` to avoid legacy route collisions.
Configure the auth provider's redirect allowlist accordingly. The GitHub App OAuth
callback must point to `/app/github/callback`; setup validates its stored state.

The existing GitHub setup contract requires an installation ID and repository ID.
The UI shows authorized repository records but does not invent an account-wide
GitHub repository picker. Source snapshots need the existing operator worker.
Source proposals do not automatically become registered executable test plans.
Customer policy activation requires those plans and a supported environment.

Hosted integrations and production execution remain unqualified. The readiness
registry, rather than configured-looking metadata, controls displayed status.
No production testing, commercial billing, public badges or automatic merging is
enabled. Team management accepts existing account IDs; email invitations are not
implemented. Project and organization operations follow the existing API scope;
the deletion confirmation explicitly names the entire organization.

Lists are bounded to 50 records per page; filters apply to that page. Related
invariant history explicitly identifies its recent-record scope. No omitted or
empty record is represented as a passing verification result. Heavy evidence and
patches use native expandable text rather than loading a separate diff framework.

## Validation investigation (18 October 2026)

The first combined database run reported 209/214, not a green run. Its five
failures had three distinct explanations:

- The new lab claim test expected the string `null` for a SQL NULL printed by
  `psql -At`; the actual output is empty. Its assertion now checks that output.
- The existing Phase 9 capability test hit the strict one-hour constraint with
  `verified_at=04:00:35.185824Z` and `expires_at=05:00:35.185825Z`. Migration 034
  samples the clock once. The existing database test now also asserts an exact
  one-hour lifetime. The constraint and permission checks remain unchanged.
- The Phase 7 `ai.distributed` journey took 6,273,798 ms and exceeded the existing
  180,000 ms observation bound. The following `ai.cost` journey took 2,471,707 ms
  and encountered stopped execution. Their missing bundles explain the final
  12-versus-16 observation assertion. Windows Kernel-Power events 506/507 show
  Modern Standby from 09:47:02 to 11:31:19 and from 11:31:19 to 12:12:34 local
  time. Those suspension intervals closely match the two elapsed test durations.
  This is environmental evidence, not a reason to relax execution bounds.

The final combined run uses fresh disposable databases and the unchanged test
ordering. A temporary process-scoped keep-awake helper was attempted, but Windows script
policy blocked it. No script-policy or power-plan setting was changed.
Final counts and acceptance status belong in the acceptance ledger once the run
has completed, not on the strength of isolated reruns.

The second combined attempt finished at 208/214 after another suspension. Windows
records a lid-triggered Modern Standby at 14:40:43 and a lid resume at 18:19:02,
followed by idle standby at 18:34:30 and keyboard resume at 19:07:45. Its failed
bad-fix journey took 11,993,079 ms; later runner/AI checks also exceeded their
execution windows or observed incomplete work. Migration 034's exact-lifetime
assertion passed. The attempted helper was later confirmed blocked by Windows script policy;
no timeout was raised to accommodate suspension. The third fresh full run passed
all 214 tests without skips in 38 minutes 51 seconds. Application validation passed
989/989 tests, and the final real-API browser journey passed all checks. The 19 October
review retains the older blocked artifact directory as an explicit manual cleanup item.
