# Phase 3 GitHub integration

This is a read-oriented GitHub App backend. Live GitHub end-to-end connectivity is **UNVERIFIED**: no real App credentials were available or invented. Deterministic transport contracts, cryptographic fixtures and disposable SQL tests are the local evidence. The OAuth return UI bridge and automatic job scheduler are not implemented.

## Permissions and identity

Configure repository **Metadata: read** and **Contents: read** only. No Checks write, Contents write, workflows, repository/organization administration or secrets permissions. The adapter rejects an installation reporting extra or write permissions. A separate future remediation integration must not expand this capability silently.

OWNER/ADMIN starts setup for a selected project, installation numeric ID, repository numeric ID and application root. The server generates 256 random bits of state and persists only its SHA-256 hash, bound to the verified principal/project/selection with a ten-minute expiry. It returns a GitHub authorization URL using the configured fixed HTTPS redirect URI. The future callback UI must send the returned code/state to the authenticated connections POST; a bare OAuth redirect cannot supply the LaunchGate bearer identity. There is no cookie-only unauthenticated callback or automatic successful installation screen.

Connection completion exchanges the code for a transient GitHub App user token, checks `/user/installations`, checks `/user/installations/{id}/repositories`, re-fetches repository metadata and requires the GitHub user's repository admin capability. The App-authenticated installation lookup must match the configured App ID, account and allowed permissions, and must not be suspended. Only these verified facts enter the service binding command. Knowing an installation ID, having an unrelated LaunchGate role or submitting arbitrary repository metadata is insufficient.

This follows GitHub's [user access token/installation intersection](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app). Live validation must confirm the configured App's user-token repository permissions response; missing admin metadata fails closed. Pagination is bounded to ten pages of 100; larger selections outside that window are unsupported, not silently authorized.

The database globally binds `(app_id, installation_id)` to one LaunchGate organization. A project and repository connection share composite tenant keys. Renames update metadata for the same numeric repository ID; they do not create a new identity. Reconnecting is a fresh verified OAuth setup. The repository inventory lists previously verified selections, not every repository available to an installation. No invitations or account-to-organization auto-enrollment is inferred.

## Credentials and provider access

Optional server configuration in `.env.example`: `LAUNCHGATE_GITHUB_APP_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `PRIVATE_KEY`, `WEBHOOK_SECRET`, `REDIRECT_URI` (each with the `LAUNCHGATE_GITHUB_` prefix). Configuration requires an RSA key of at least 2048 bits and a webhook secret of at least 32 characters. Do not expose configuration diagnostics/values in public health.

App JWTs use RS256 and an eight-minute future expiry with one minute of clock-skew allowance. User tokens are kept only in the setup call; installation tokens are minted per ingestion, scoped to exactly one repository ID and explicit read permissions, with a checked short expiry. No token, OAuth code, private key or raw webhook body is persisted. OAuth user tokens are not refreshed or cached. GitHub currently controls their actual lifetime; in-memory handling is not provider-side revocation.

See GitHub's [installation-token scoping requirements](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app). Requests use only fixed `api.github.com` paths and the fixed GitHub OAuth exchange endpoint, reject redirects and bound response bytes/time. Repository URLs, import specifiers, configuration, package scripts and README instructions never select a network destination.

The narrow server `SourceStore` exports named provider/worker commands only, not a Supabase client or unrestricted table query. `lg_source_service` is callable only by service_role; that role receives no direct grants on new tables. Ordinary reads and request/confirmation commands use the user token and RLS. The service-role key and App private key remain in the trusted host and never enter parser workerData/environment. This is a code boundary, not a claim that a compromised control plane cannot access its own configured credentials.

## Webhooks

`POST /api/v1/webhooks/github` reads at most 256 KiB, verifies the exact raw body with HMAC-SHA256 and timing-safe comparison, then validates JSON and UUID delivery ID. The [GitHub signature contract](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) authenticates the body, not a timestamp; freshness is not inferred from a nonexistent signed delivery timestamp.

Supported event types: `installation`, `installation_repositories`, `repository`. Unknown signed types are recorded as IGNORED. Deleted/suspended installations, removed repositories, repository transfers/deletion/privatization conservatively revoke the bound installation. Addition/unsuspension events never grant or reactivate access. A new OAuth verification is required; this avoids trusting out-of-order events to restore privileges. Removal currently revokes the entire installation rather than guessing which existing analyses remain authorized.

The durable inbox uniqueness key is provider GITHUB / mode APP / configured App ID / delivery UUID. It stores installation/account association through the bound installation, payload digest, allowlisted action, receipt/processing times and state, never raw payload or secret headers. Inbox insert, revocation and cancellation of queued/running snapshot leases commit atomically. Duplicate delivery IDs produce no repeated effects. Replayed revocations cannot create connections; grants never originate in webhooks. No background webhook retry queue is claimed: transactional errors return failure for provider redelivery.

User setup, connect/disconnect, snapshot requests/retries and proposal review write existing security audit events. Provider revocation has durable provider identity/timing in the integration inbox; it does not impersonate a human audit actor.

## API and jobs

All project paths begin `/api/v1/projects/:projectId` and require a verified principal and project access:

| Suffix | Method / role | Meaning |
| --- | --- | --- |
| /github/setup | POST ADMIN | Start state-bound OAuth setup for `{installationId,repositoryId,applicationRoot?}` |
| /github/connections | POST ADMIN | Complete `{state,code}` after provider verification |
| /github/connections | GET member | List project connections |
| /github/connections/:connectionId | DELETE ADMIN | Disconnect and invalidate pending/running leases |
| /github/repositories | GET ADMIN | List up to 100 verified organization selections |
| /repositories/:connectionId/snapshots | POST DEVELOPER | Queue immutable `{commitSha}`; dedupe connection/SHA/analysis version |
| /snapshots/:snapshotId | GET member | Safe snapshot status without lease token |
| /snapshots/:snapshotId/analyze | POST DEVELOPER | Idempotently request/retry analysis; returns 202, never keeps request running |
| /snapshots/:snapshotId/architecture | GET member | Immutable static report |
| /snapshots/:snapshotId/invariant-proposals | GET member | Provenance-linked proposals |
| /invariant-proposals/:proposalId/confirm | POST ADMIN | Versioned `{action,statement,requestKey}` review |
| /invariant-proposals/:proposalId/confirmations | GET member | Review history |

Lists are bounded, not exports; pagination beyond 100 is future work. No anonymous arbitrary-repository scanner exists.

`processSnapshot(snapshotId)` is the separately hosted trusted Node worker entry point. It claims a two-minute database lease, verifies current requester membership, project/connection/installation activity, fetches exact source, runs the bounded parser and atomically publishes immutable metadata. A lease check precedes subsequent repository reads; completion revalidates current authority and fencing. A request already in flight can finish before revocation is observed; new reads/publishing then stop. Unfinished expired leases can be reclaimed. Revoked or disconnected jobs cannot be retried until access is restored through the authorized workflow. Retrying a completed snapshot does not mutate its evidence.

Phase 4 must supply scheduling, deployment, monitoring, fairness, distributed quotas and cleanup. The HTTP API honestly returns `EXTERNAL_WORKER_REQUIRED`; no detached work is launched from a serverless request. No customer code, builds or tests execute in this worker.
