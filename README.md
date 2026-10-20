# LaunchGate

**Your AI says it works. LaunchGate proves it can ship.**

LaunchGate helps developers discover the business invariants their app should
satisfy, reproduce failures, and gate releases using recorded verification evidence.

**Not production-ready yet.** Hosted integrations and execution providers still
require operational qualification. Local Reference Lab evidence is labelled and
must not be represented as verification of a customer deployment.

Phase 13 adds safe qualification inventory, configuration-bound status and durable diagnostic budgets. `npm run launchgate:qualify` produces a local report without provider calls. Dedicated assets remain unavailable; see [staging setup](docs/launchgate/staging.md) and [live matrix](docs/launchgate/live-qualification-matrix.md).

- Free local inspection and `/assess` suggest stack and invariant families without
  executing repository code. Static analysis does not prove runtime behavior.
- Connect a GitHub repository, confirm intended invariants, and authorize an owned
  preview/staging deployment before dynamic verification.
- Authoritative release decisions are SHIP, BLOCK or INCONCLUSIVE. Incomplete
  required assurance does not approve a release or pass CI.
- Remediation proposals require explicit approval, bounded patches, isolated replay
  and required adjacent coverage before a fix can be considered verified.
- The CLI and repository-local GitHub Action bring exact-commit checks into developer
  workflows. Sharing is explicit; badges describe a release policy and tested scope,
  with freshness checks rather than permanent security claims.

Build the unpublished CLI with `npm run build:cli`, then run
`node packages/cli/dist/main.mjs inspect --json`. Nothing is published to npm or
GitHub Marketplace. See [CLI](docs/launchgate/cli.md),
[Action](docs/launchgate/github-action.md), [assessment](docs/launchgate/public-assessment.md),
[sharing](docs/launchgate/share-pages.md), [badges](docs/launchgate/verified-badge.md),
and [distribution security](docs/launchgate/distribution-security.md).

LaunchGate owns `/` and `/app`. StartupX remains available at `/startupx`; its code
and history are preserved below.

---

# StartupX AI / LaunchGate foundation

The running application remains StartupX AI. LaunchGate Phase 1 adds deterministic contracts and server foundations without replacing product pages, payments, migrations or integrations.

## Local setup

Use Node **24.19.0** (`.node-version`) and npm 11. This runtime passed the repository baseline and Phase 1 toolchain. Next 15.5.27 supports this Node family. Three private npm workspaces under `packages/` share TypeScript contracts; all commands run from this root.

```powershell
npm.cmd install
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test
npm.cmd run test:launchgate
npm.cmd run test:database
npm.cmd run build
npm.cmd run dev
```

CI uses `npm ci` from the committed lockfile, then typecheck, lint, tests and build. Unit/contract tests and build do not require provider credentials. The test runner uses `react-server` conditions for the genuine `server-only` import guard. Existing tests are preserved. ESLint now scans tests too; a pre-existing unused `describe` import is reported as a warning rather than hidden.

Copy `.env.example` to `.env.local` only when setting up local configuration. Restore real credentials securely; do not commit them. Placeholders are classified separately from missing, malformed and structurally configured values. Configured does not mean the provider has accepted a credential. Browser Supabase configuration remains in its existing browser-safe helper; service secrets stay in server-only modules.

`GET /api/health` is a public **liveness** endpoint. It returns an aggregate configuration state and explicitly says integrations are not probed and production readiness is not assessed. No individual provider flags or secret values are public. `/internal` remains, but its old provider-check list is intentionally empty.

## Existing product

Next.js App Router, React, Tailwind, Supabase authentication/persistence, Anthropic analysis and Razorpay checkout. Founder tools, evidence workflows, reports/sharing, marketing and account pages remain. Builds do not prove live authentication, database, AI or payments work without credentials.

Historical SQL migrations 001-013 live in `migrations/`. Do not use old README SQL as an alternative schema: it differed in user ID types and could create an overly broad insert policy. Inspect deployed schema/grants and reconcile drift before applying future migrations. No migration is added or applied by Phase 1.

## LaunchGate

Phase 2 adds organization tenancy, scoped authorization, RLS, security audit, secret/retention metadata and deletion tasks. Apply forward migrations 014/015 only after reviewing the deployed schema. [Tenancy setup, API and database testing](docs/launchgate/tenancy.md) documents the boundary. `test:database` creates disposable PostgreSQL/PostgREST containers and accepts no production connection string. Docker absence is reported as BLOCKED_BY_ENVIRONMENT; CI requires the suite to execute.

- [Architecture and trust boundaries](docs/launchgate/architecture.md)
- [Tenancy, roles, RLS and deletion](docs/launchgate/tenancy.md)
- [GitHub App backend and credential boundaries](docs/launchgate/github-integration.md)
- [Bounded static source ingestion](docs/launchgate/source-ingestion.md)
- [Architecture observations and invariant review](docs/launchgate/invariant-discovery.md)
- [Threat model](docs/launchgate/threat-model.md)
- [V1 acceptance ledger](docs/launchgate/v1-acceptance.md)
- [Reference Lab](docs/launchgate/reference-lab.md)
- [Legacy transition](docs/launchgate/legacy-transition.md)
- [Dependency triage](docs/launchgate/dependency-audit.md)

Core outcomes are PASS, REPRODUCIBLE_FAILURE and INCONCLUSIVE. NOT_APPLICABLE is metadata. Release decisions are separate. Pure semantic tests are not customer verification, cryptographic evidence admission or signed attestations. The Phase 0 billing/quota/RLS/recovery risks remain pending explicit future work.

`startupxai-final` preserves the archived StartupX baseline. Development stays on `launchgate-rebuild`; do not modify main or rewrite migration history.

### LaunchGate Phase 4

Durable orchestration and target authorization now have PostgreSQL commands, a separate orchestrator/runner protocol, Vercel ownership contracts, SSRF-resistant transport and sealed infrastructure observations. Start with [the orchestration guide](docs/launchgate/orchestration.md). Provider credentials and a production isolated runner backend remain deployment requirements; no customer code or attack suites run in this phase.

### LaunchGate Phase 5

Authentication, tenant isolation and privilege verification now execute against disposable synthetic HTTP fixtures only. The [verification engine](docs/launchgate/verification-engine.md) compiles fixed operations, requires positive controls and fresh-state reproduction, and seals scoped findings. [Fixed replay and native regressions](docs/launchgate/reproduction.md) preserve the original oracle. [Runtime setup](docs/launchgate/reference-lab-runtime.md) and [finding APIs](docs/launchgate/findings.md) describe the local-only boundary. Migrations 020/021 are forward additions; no production sandbox safety or arbitrary customer deployment testing is claimed.

`npm test` includes the dynamic fixture suites. `npm run test:phase5-journey` runs the complete disposable database rehearsal and durable finding/fix/regression journey; set `LAUNCHGATE_REQUIRE_DATABASE=1` to make unavailable Docker a failure. No provider credentials or production data are used.

### LaunchGate Phase 6

[Billing verification](docs/launchgate/billing-verification.md) adds 27 controlled billing/webhook cases with real local HTTP and transactional SQLite fixtures. [Webhook contracts](docs/launchgate/webhook-verification.md) and [confirmed entitlement policies](docs/launchgate/entitlement-model.md) reuse the existing reproduction, finding, fixed replay and regression pipeline. Run `npm run test:billing-lab` and `npm run test:phase6-journeys`. All provider events are synthetic and financial spend is zero; live Stripe/Razorpay compatibility and production StartupX billing fixes are not claimed.
### LaunchGate Phase 7

[AI cost verification](docs/launchgate/ai-cost-verification.md) adds synthetic provider observation, [atomic quota and shared rate-limit checks](docs/launchgate/quota-verification.md), and [controlled Chromium journeys](docs/launchgate/browser-journeys.md). Install the matching browser with `npm run browser:install`; run `npm run test:ai-lab`, `npm run test:browser-journey`, and `npm run test:phase7-e2e`. Only disposable Reference Lab targets execute; no paid AI calls, customer scripts or live provider certification are involved.
