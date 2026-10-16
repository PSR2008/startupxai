# Verified resolution

Resolution requires a reproduced original finding, a new exact source revision,
an authorized non-production preview, the original logical replay, passing
positive controls and all required adjacent regressions. A patch, PR or build
alone cannot resolve a finding. No model output is a verdict.

The original plan preserves invariant/version, operations, actor/resource roles,
assertions, sequence, seed and business policy. Fresh concrete IDs, credentials,
sessions and signatures are generated for execution. The old manifest remains
immutable. New evidence is bound to the new revision and deployment before the
grant is signed; evidence is never relabeled after execution.

Phase 8 supplies policy coverage, impact selection, freshness, manifests and the
release candidate. Mandatory adjacent cases include tenant write for tenant read,
owner role management for role mutation, concurrent delivery for webhook dedupe,
and concurrent quota admission for quota reservation. Auth changes require the
broader auth/tenant/role/browser baseline. Missing registered adapters remain
NOT_RUN and prevent VERIFIED. Waivers and NOT_APPLICABLE items cannot substitute
for a required passing fix-verification test.

During a remediation, the existing replay collector holds the finding in
FIX_VERIFICATION even if the originating replay passes. The gate can recognize
that exact active replay without claiming resolution, then evaluate all remaining
coverage. Only the final verification command can set RESOLVED after the complete
policy passes. It checks the persisted release evaluation and completed replay;
browser users cannot supply either result.

Failure mapping:

| Condition | Remediation result |
|---|---|
| Original failure still reproduces | VERIFICATION_FAILED |
| Required adjacent reproducible failure | VERIFICATION_FAILED |
| Missing/mismatched preview, stale evidence or unavailable adapter | INCONCLUSIVE |
| Positive control fails, including deny-all 403 | INCONCLUSIVE |
| All required replay/controls/regressions pass | VERIFIED |

The proof chain records proposal and patch hash, original finding/manifest,
vulnerable revision/deployment, fixed revision/deployment, original plan hash,
release, coverage, new manifests, verification time and freshness boundary. The
permanent native regression remains linked. Later reproduced recurrence changes
the finding to REGRESSION_FAILED while preserving the earlier verified fix record.

The Phase 8 release check remains the release-policy check. Fix-check output maps
VERIFIED to success, reproduced failure to failure, and incomplete verification
to action_required. No neutral/skipped approval is used. Live publication and
branch-protection enforcement remain unverified; see [GitHub Checks](github-checks.md).

The Reference Lab acceptance journey exercises real local HTTP/SQLite behavior
for tenant, role, webhook and quota patches, including authorized controls and
adjacent regressions. The bad-fix fixture leaves observability available but
returns 403 for every business operation. It cannot resolve the finding.
