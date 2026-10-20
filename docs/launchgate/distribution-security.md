# Distribution security boundaries

Human CLI sessions and project CI credentials are separate database identities.
Human sessions expire after one day and re-check current project membership. CI
credentials bind organization/project, expire within ninety days, rotate in place
with immutable IDs, and support immediate revocation. Their raw 256-bit secrets are
shown once; only hashes are persisted. Last-used metadata is service-owned.

Credential management requires OWNER/ADMIN; viewer and cross-tenant access fails.
Machine authentication runs only through a constrained service RPC, never a
Supabase user principal. It permits release history and exact gate checks/reconciliation.
CI cannot access findings, team/org administration, secrets, exceptions, sharing,
remediation authorization or fix PR creation. Candidate creation remains owned by
the existing source/deployment pipeline. No browser supplies evidence admission.

New metadata tables force RLS. Browser roles have limited metadata-column SELECT
grants, no credential-hash access and no direct writes. Public APIs receive only
controlled projections. Service functions are not executable by browser/anonymous
roles. Creation/rotation/revocation, share changes and public/badge configuration
append existing audit records without tokens.

CLI login uses a random state and a loopback-only HTTP receiver. A signed-in browser
requires explicit approval, creates a one-day session, and delivers it only to the
validated loopback callback. The receiver requires the configured server Origin
and state, caps body size and lifetime, and never puts credentials in URLs. Failed
delivery attempts revoke the newly created session. Tokens are verified before storage.
Only `/app/cli` permits loopback connections in its CSP; all other routes retain
their existing connection policy. The authorization page sends no referrer.

The credential-store interface is injectable. The initial fallback stores a human
credential outside repositories with owner-only permissions (POSIX) or user-only
ACLs (Windows), and prints a warning that an OS keychain is unavailable. No CI token
is persisted. Logout removes the local credential even if remote revocation fails;
the one-day expiry remains the server fallback in that case. Native keychain
providers may implement the same interface without changing the protocol.

Public abuse controls are durable, globally bounded and independent of untrusted
forwarding headers. Cache keys bind immutable identity; cache completion uses fenced
leases. Static results cannot contain a dynamic decision. Public text is escaped,
SVG states are fixed, repository hosts are allowlisted, redirects disabled and
credential-bearing clients cannot be redirected. URL origins cannot come from repo
configuration. Action inputs are parsed data, never shell expressions.

Daily aggregate telemetry permits only enumerated event names and counts, with no
source, secrets, prompts, bodies or user identity. Counters retain ninety days.
Public DNT/GPC opts out. Offline CLI inspection makes no network calls by default.

Local fixture and contract tests do not certify hosted GitHub, Windows/macOS/Linux
keychain deployments, proxy header configuration or production access-log redaction.
Those remain explicit operational qualification requirements, not a production-ready
claim. StartupX remains independently available at `/startupx`.
