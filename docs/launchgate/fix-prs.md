# Optional fix PR authority

The analysis GitHub App retains Contents read and optional Checks write. Phase 9
does not upgrade it. Remediation uses a separately configured App with only
Contents write, Pull requests write and Metadata read. Workflow, secrets,
administration and organization permissions are refused.

An OWNER/ADMIN explicitly enables a selected repository via
`POST /api/v1/projects/:id/remediation-capabilities` with `connectionId` and
`installationId`. The server resolves the numeric repository from the existing
authorized connection, verifies the separate App installation and repository,
and records an expiring capability. The server configuration is
`LAUNCHGATE_REMEDIATION_APP_ID` and `LAUNCHGATE_REMEDIATION_PRIVATE_KEY`; it must not
identify the analysis App. Revoke with
`POST /api/v1/projects/:id/remediation-capabilities/:id/revoke` and `{}`.

Enabling a capability is not consent to create a PR. A distinct PR request is
required after patch validation. Installation permissions and expiration are
checked again for writes; the provider accepts a durable-authority checkpoint
before every external request. Installation tokens are narrowed to one numeric
repository and never returned or persisted in proposals, audit or PR metadata.

The adapter verifies the exact base SHA, complete tree, original blob digest and
regular-file mode before creating a tree and single-parent commit. It creates
only `launchgate/fix/<finding UUID>-<proposal UUID>`. Existing branches must match
the expected fix commit; otherwise the operation stops. No update-ref, force
push, merge or deployment endpoint exists. Commit authorship identifies
LaunchGate automation. Fixed request timestamps make retry commit identity
stable; branch and PR reconciliation fail closed on ambiguous results.

PRs are drafts with `FIX PROPOSED — VERIFICATION PENDING`, safe identifiers,
changed paths and a pending product-link placeholder. Raw source context,
exploit payloads and tokens are not included. A human decides whether to merge.

The controlled worker currently creates a local PR representation and synthetic
content-addressed preview. The GitHub adapter and capability activation are
implemented and tested with injected transports, but the customer source/preview
workflow is unavailable. Therefore **live GitHub PR E2E and Vercel preview E2E
remain UNVERIFIED**. No real branch or PR was created during implementation.

API behavior follows GitHub's [reference creation](https://docs.github.com/en/rest/git/refs#create-a-reference),
[commit creation](https://docs.github.com/en/rest/git/commits#create-a-commit) and
[pull request creation](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request)
contracts. An upstream timeout does not prove whether a write occurred; retries
must reconcile the dedicated branch and proposal identity before creating again.
