# GitHub Checks and merge safety

The existing GitHub App gains only **Checks: write**. Repository contents remains **read**; metadata remains read. Ingestion installation tokens continue to request only contents/metadata read. Publication tokens are narrowed to the selected numeric repository and checks write/metadata read. No contents-write permission, workflow write, fix PR or auto-merge is implemented.

The check name is **LaunchGate Release Gate**. Every check binds exact `head_sha`. A stable external ID includes connection UUID and exact SHA. Before creating, the adapter reconciles matching checks by external ID, SHA and expected App ID; retries update the existing operational check. Multiple ambiguous matches fail closed. A new SHA gets a separate check. Same-SHA evaluations preserve immutable local history while updating the operational check under a durable lease. Verification in progress is represented by non-approval before a final result.

| Release decision | GitHub conclusion | Meaning |
|---|---|---|
| SHIP | success | Policy satisfied for the tested scope |
| BLOCK | failure | Applicable reproduced policy violation |
| INCONCLUSIVE | action_required | Assurance incomplete, not a confirmed vulnerability |

Never use success, neutral or skipped for incomplete required coverage. GitHub treats successful, skipped and neutral required checks as merge-satisfying. Configure a branch ruleset/protection rule requiring the exact check name and expected GitHub App, with checks required on the latest commit. Enable the repository's appropriate up-to-date requirement; restrict bypass permissions. LaunchGate does not modify branch protection and cannot prevent configured administrator/ruleset bypass. See GitHub's [required status check troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) and [Checks API](https://docs.github.com/en/rest/checks/runs).

SHIP output includes the assurance expiry time. The worker automatically starts a new non-approving generation after expiry. GitHub has no native check TTL; worker/provider downtime can delay updates. Operators must monitor availability and require fresh re-evaluation after expiry rather than relying indefinitely on a historical success.

Output is an allowlist of exact SHA, policy version, time, coverage counts, regression count, exception count and safe generated finding/invariant identifiers/severity. It does not include raw observations, customer statements, payloads, waiver reasons, provider errors or secrets. SHIP does not say globally secure. Incomplete assurance does not claim a vulnerability.

V1 signed events: branch push, same-repository pull_request opened/synchronize/reopened/ready_for_review, and check_suite requested/rerequested. Raw bytes are HMAC-verified before interpretation. App/delivery IDs deduplicate durably; conflicting repeated payload digests fail. Fork PRs and deleted branches are not scheduled. Installation/repository revocation continues through the existing webhook path. Events can request discovery, never grant repository access or establish deployment ownership. Deployment arrival is reconciled from existing verified provider records, not an event URL.

Without credentials, `npm run test:github-checks` verifies exact SHA, mapping, same-SHA reconciliation, new-SHA separation, narrow permissions, redaction and signed-event handling. Database tests verify durable inbox deduplication and publication trust boundaries. **Live GitHub Checks E2E and actual merge blocking remain UNVERIFIED.**
