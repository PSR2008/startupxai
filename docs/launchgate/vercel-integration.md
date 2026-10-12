# Vercel integration foundation

The adapter uses read-only GETs to fixed `api.vercel.com` endpoints: `/v2/teams/:id`, `/v9/projects/:id`, `/v13/deployments/:id?withGitRepoInfo=true`. It requires confirmed team OWNER membership, exact account/project, READY preview/staging deployment, GitHub numeric repository ID and full commit SHA. Personal-account and custom deployment-domain flows are not enabled. Production targets and missing ownership fields fail closed.

`LAUNCHGATE_VERCEL_CONNECTIONS` is an optional operator-managed JSON array. Each entry has LaunchGate `organizationId`, `projectId`, UUID `credentialReference`, `accountId` (`team_*`), `providerProjectId` (`prj_*`) and `token`. It stays server-side. Do not place the array in browser configuration or logs. Provision through the deployment's secret manager. LaunchGate API callers never supply a token or choose another account mapping.

An authorized deployment-registration request verifies provider facts, registers the organization-bound connection and creates an expiring proof. Unique account/project binding prevents cross-tenant reuse. Revoked connections fail closed and are not silently reactivated by deployment discovery. Reconnecting a revoked provider requires a separately reviewed operator workflow. No deployment is created, modified or deleted.

Only the response's immutable deployment `id` and `url` are used. `alias` is ignored. Re-registering an ID with a different URL/commit/environment/repository is rejected. Runs require exact snapshot/deployment commit agreement; missing or mismatched provenance cannot start.

The runner supports host-bound automation bypass through a header. Provider-wide credentials stay in the control plane. Response size is capped at 1 MiB, timeout at ten seconds, and redirects are rejected. Full provider response metadata, which can contain secrets, is discarded after extracting validated fields.

Live Vercel E2E is **UNVERIFIED**: no credentials were supplied or used. Strict mocks cover owner/project/organization/repository/commit/deployment mismatches and missing facts. Field compatibility with a live account must be rehearsed before rollout.

Official contracts consulted: [deployment retrieval](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url), [team membership](https://vercel.com/docs/rest-api/teams/get-a-team), [automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
