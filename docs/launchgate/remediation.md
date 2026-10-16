# Constrained remediation

A generated patch is a proposal. A PR or successful build is not a verified fix.
Phase 9 supports explicit OWNER/ADMIN requests, bounded source transformations,
private patch artifacts, controlled previews and the existing exact replay engine.
Developers and viewers may read their organization's records but cannot request
generation, create PRs, enable write capability or declare resolution in V1.

## Consent and eligibility

Generation, validation, PR creation and verification are distinct audited actions.
Each request has an idempotency UUID. Finding discovery never creates a PR.
The originating finding must already have reproduced evidence and its permanent
native regression. Policy must require that original invariant and plan.

Eligibility is `SUPPORTED_AUTOMATIC`, `SUPPORTED_PROPOSAL_ONLY`, `MANUAL_REQUIRED`,
`UNSUPPORTED` or `INSUFFICIENT_CONTEXT`. Automatic transformation is restricted to
the exact registered Reference Lab source bytes for tenant reads, owner role
mutation, duplicate webhooks, quota reservation and protected API access. Other
customer snapshots are proposal-only; the current worker reports unavailable
customer adapters as INCONCLUSIVE. It cannot execute arbitrary customer code.

The deterministic provider removes the known vulnerable bypass at the existing
server enforcement point. Quota remediation also moves the controlled concurrent
request barrier before admission so rejected callers cannot strand admitted work.
No fixture oracle, business policy or positive control is changed by the patch.

## Patch boundary

Proposals bind finding, invariant/version, original source revision, plan hash,
source-context hash, patch, provider metadata and risk. Repository text is
untrusted data. Context is limited to four files of at most 64 KiB each. Suspected
secret-bearing context is refused rather than sent to a model or persisted as a
proposal. The optional provider interface has a timeout, bounded structured output
and schema validation; no live model provider is configured.

The parser accepts a small unified-diff grammar with exact line matching. Limits
are four existing source files, 160 added/removed lines and a 32 KiB diff. It
rejects traversal, binaries, file modes, symlinks, renames, deletions, unrelated
paths, tests, workflows, migrations and policy/oracle edits. Syntax and Phase 3
architecture provenance are checked before and after application. Pattern checks
are defense in depth: executable automatic patches must additionally match an
exact registered transformation. This rejects arbitrary feature removal, broad
denial, assertion weakening, admin bypasses, secret insertion and exfiltration.

## Isolation and lifecycle

Validation uses an exclusively created `launchgate-remediation-*` source-only
workspace. No credentials, repository history, package installs or customer build
scripts are copied or executed. For controlled fixtures only, the registered
patched module is transpiled and loaded with trusted harness dependencies. This
is a trusted local fixture runner, **not a production sandbox for customer code**.
The lab revision is a content-addressed synthetic revision, not a fabricated
GitHub commit. It is signed into the execution grant before requests begin.

Workspace cleanup runs on success and exceptions. Final VERIFIED evidence is
persisted only after workspace disposal succeeds. Collectors dispose local HTTP
servers, SQLite state, test identities and sessions. Durable leases fence workers;
dispatch affinity prevents ordinary runners from claiming patched preview jobs
and prevents remediation workers from claiming unrelated jobs. Hard process
termination can still require inventory-based cleanup of exact owned resources.

State is stored separately from immutable context, patch and PR facts. Terminal
verification records cannot be rewritten. Retained private evidence uses the
existing artifact-store interface; a production host must configure private
storage and its retention policy. No public artifact sharing is created.

## API and worker

The project-scoped API provides:

- `POST/GET findings/:findingId/fix-proposals`
- `GET fix-proposals/:proposalId`
- `POST fix-proposals/:proposalId/validate`
- `POST fix-proposals/:proposalId/pull-request`
- `POST fix-proposals/:proposalId/verify`

POST actions accept `requestKey`. Generation additionally requires `policyId` and
`policyVersion`; subsequent actions accept no patch, outcome or deployment data.
All paths are under `/api/v1/projects/:id/`. Browser DML and service RPC access are
denied by RLS/grants. Parent references include organization and project scope.

The separate worker entry is `scripts/launchgate-remediation-worker.ts`, invoked
with `node --conditions=react-server --import tsx`. It requires explicit
`LAUNCHGATE_REMEDIATION_LAB_ENABLED=1`, the existing Supabase server configuration,
an Ed25519 `LAUNCHGATE_RUNNER_PRIVATE_KEY`, and an absolute
`LAUNCHGATE_PRIVATE_ARTIFACT_ROOT` outside the control-plane checkout. Do not run
this process as a general customer-code worker. The live worker was not launched
during local acceptance testing.

See [fix PRs](fix-prs.md) and [verification](fix-verification.md).
