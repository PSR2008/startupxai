# LaunchGate CLI

The workspace is `packages/cli`, with the future binary `launchgate`. It has not
been published. Build locally with `npm run build --workspace @launchgate/cli`;
invoke it with `node packages/cli/dist/main.mjs` from this checkout. The build
copies the existing Phase 3 analyzer into the distributable and depends on the
same pinned TypeScript parser. It does not require the private analyzer package
at runtime.

Implemented commands:

* `inspect`: offline, bounded syntax inspection with no account or network.
* `check --local`: explicitly static inspection, with the same disclaimer.
* `preflight`: static inspection plus local project-link state. Remote verification
  and unresolved regressions are explicitly **NOT_CHECKED**.
* `init [--project UUID] [--organization UUID]`: create `launchgate.config.json`
  without overwriting an existing file. Detect the local Git directory and origin
  by reading data; Git hooks, includes and commands are never invoked.
* `check --release UUID [--sha SHA]`: read an existing authoritative release.
* `open`: print the configured project's safe web URL; no shell/browser execution.
* `version`: display CLI and protocol versions.

`--json` emits one JSON document with `schemaVersion: 1`; `--quiet` suppresses
human output without suppressing explicitly requested JSON. No automatic updates.

Static output prominently states:

> Static analysis only. Runtime business invariants have not yet been proven.

Static success means the operation completed; it never produces a release decision.
Proposed invariants require confirmation. Ingestion excludes generated content,
credential files and directory links, bounds file/tree/byte counts, and runs the
existing parser in its resource-limited worker. No package install, customer tests,
scripts, compiler plugins, executable config or repository imports run.

The config schema accepts only schema version, organization/project UUIDs, GitHub
repository identity, environment, policy UUID and selected invariant UUIDs. It
cannot specify an API host or credentials. Unknown fields are rejected.

Set `LAUNCHGATE_URL` to the reviewed server origin. `launchgate login` opens a
browser authorization page, requires explicit approval, verifies the resulting
one-day human session, and saves it using the credential-store abstraction.
`whoami` verifies the current session server-side. `logout` revokes it and removes
the local file; local removal still happens if the server is unreachable.

The initial OS-independent fallback is a user-only file under the user's home
outside repositories. A warning states that a native keychain is unavailable.
Credentials are bound to server origin. No token is put in repository config or
shell arguments. Native keychain providers can implement the injectable interface.
Tests use fake stores and synthetic tokens.

CI uses a distinct project-scoped `lgci_` credential in `LAUNCHGATE_TOKEN`; it is
never persisted. Interactive human credentials cannot be used as CI credentials.
Without CI authentication, noninteractive operations fail without a prompt.
`releases`, `findings` (human only), and `status` provide bounded safe history.
`check --release UUID --wait --timeout 300` polls for at most the configured interval
(1-900 seconds), with bounded network requests. A missing result stays INCONCLUSIVE.

Browser management uses verified membership and caller RLS; machine commands use
a separate constrained service RPC. The versioned release projection contains
project/release/commit identity, decision, expiry, coverage counts and a safe
reproducible-failure count. Approval requires the current DECIDED generation and an unexpired gate.
The client additionally checks requested identity and optional exact SHA. Unsupported
protocols fail closed. Coverage and findings are aggregate counts, never raw evidence.
The exact release JSON fields are `schemaVersion`, `type`, `projectId`, `releaseId`,
`commitSha`, `decision`, `validUntil`, `coverage` (required/passed/failed/incomplete),
and `findings` (reproducibleFailures). Missing aggregate data is represented as null.

| Exit | Meaning |
| --- | --- |
| 0 | Successful local operation, or authoritative current SHIP |
| 1 | Authoritative BLOCK |
| 2 | INCONCLUSIVE, including expired SHIP |
| 3 | Configuration, local inspection, arguments or authentication failure |
| 4 | Transport/server error or response identity mismatch |
| 5 | Unsupported command or protocol |

Focused tests: `npm run test --workspace @launchgate/cli`. They cover static
projection, hostile content, symlink/junction exclusion, bounds, config writes,
identity/expiry/exit behavior, protocol errors, cancellation and redaction.
Windows has been exercised locally; Linux/macOS execution remains to be verified.
Phase 12 acceptance is recorded separately in the acceptance ledger.
