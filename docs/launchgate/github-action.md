# GitHub Action

The repository-local action is `.github/actions/launchgate-check`. It runs trusted
JavaScript directly, never a shell built from inputs. It imports the shared CLI
protocol client from this checkout; keep the action and CLI files together when
checking out a reviewed immutable revision. Nothing has been published.

Normal use needs only `contents: read` for checkout. It needs no contents-write,
PR-write, issues-write, repository administration or remediation permission.
Use a project-scoped `lgci_` credential, stored as a GitHub Actions secret. Human
CLI credentials and Supabase sessions are rejected by the action.

After your reviewed checkout step, add:

```yaml
permissions:
  contents: read
steps:
  - uses: ./.github/actions/launchgate-check
    env:
      LAUNCHGATE_TRUSTED_ORIGIN: ${{ vars.LAUNCHGATE_URL }}
    with:
      project: YOUR_PROJECT_UUID
      server: ${{ vars.LAUNCHGATE_URL }}
      token: ${{ secrets.LAUNCHGATE_CI_TOKEN }}
      wait: 'true'
      timeout: '300'
```

`server` must be HTTPS and exactly match the independently configured trusted
origin. Do not derive either value, the action implementation, or secret-bearing
workflow steps from an untrusted PR. Pin external checkout/setup actions to your
reviewed immutable revisions. The LaunchGate action itself has no external action
dependencies. Forked PRs without a credential fail closed; do not expose secrets
through `pull_request_target` plus untrusted checkout.

Push/manual runs bind `github.sha`. PR runs retain the workflow/merge SHA in the
summary and bind the candidate to exact PR head and base SHAs. Branch labels are
never release identity. The action reconciles an existing candidate produced by
the connected GitHub/deployment pipeline. It does not fabricate a deployment or
execute source to create one. Missing candidates remain INCONCLUSIVE while waiting.

SHIP exits 0, BLOCK 1, INCONCLUSIVE 2, configuration/auth errors 3, transport/server
errors 4, incompatible protocol 5. No advisory-success mode exists. Polling is
bounded to 1–900 seconds; each request has an independent 15-second transport
deadline. Cancellation fails. Results include a safe job summary and decision/release
outputs. Tokens are masked before diagnostics, never persisted, and never included
in summaries. Redirects are disabled.

Existing GitHub Checks remain the durable App publication mechanism; this action
adds no noisy PR comments. Live GitHub qualification remains unverified locally.

Repository CI pins checkout, setup-node and artifact upload to reviewed upstream
commit IDs, each using Node 24. Their inputs were checked against the pinned
upstream metadata. Node 24 action metadata is documented in the
[GitHub metadata reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax).
The distribution browser acceptance harness builds and serves production artifacts;
it does not depend on development hot compilation.
