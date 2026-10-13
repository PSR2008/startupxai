# Reference Lab runtime

`reference-lab/` is intentionally separate from application routes. Its vulnerable code is imported only by the controlled host and tests. It runs real HTTP servers on random 127.0.0.1 ports in the disposable Node test process. It is not a production isolation boundary, cloud sandbox, customer staging tester or customer-code executor.

| Family | Registered cases | Variants and expected result |
|---|---|---|
| Authentication | API, route, action, invalid session, expired session, logout | vulnerable: REPRODUCIBLE_FAILURE; fixed: PASS; inconclusive: INCONCLUSIVE |
| Tenant isolation | cross-tenant read, write, delete with substituted resource IDs | same three outcomes |
| Privilege escalation | member→owner, member→admin, viewer→developer, developer→owner | same three outcomes |

Fixture version is 1. Each plan has an explicit deterministic seed. The same initial logical business state is provisioned for each variant. Enforcement changes for vulnerable/fixed; observation deliberately fails in the inconclusive variant. Fixtures contain only synthetic data, no payments or provider credentials.

Logical identities are anonymous, tenant_a_owner/member/viewer/developer and tenant_b_owner/member. Each maps to a new concrete UUID; authenticated identities get ephemeral random bearer sessions. resource_a/resource_b have separate tenant ownership and synthetic PRIVATE_A/PRIVATE_B markers. Provisioning records UUID mappings without tokens. Logical state hashes exclude generated IDs/tokens, permitting exact logical reproduction after reset.

Reset means closing the server and every connection, clearing sessions and discarding state, then provisioning a new runtime. There is no public reset API. Health and selected-state observation endpoints require a random host-only lab scope capability, separate from the application session being tested. Cleanup failures are visible and prevent conclusive results.

The production TargetClient explicitly rejects lab grants. Only LocalLabProvider can map the reserved `https://reference-lab.invalid/` identity to its own freshly created server capability. No caller can submit a loopback URL or use this provider to bypass customer-target SSRF policy. Production public-IP checks, DNS pinning, redirect prohibition and allowlists remain unchanged.

The local harness includes side-effect-after-403, sanitized-200, masked-404, server-error, timeout, missing-credential and cleanup/runner-failure cases. Active fixture accounting checks disposal, including abort paths. There is no external network dependency during fixture execution. The database suite needs the pinned PostgreSQL/PostgREST images locally available (first use may pull them).

Run `npm run test:phase5-journey` with `LAUNCHGATE_REQUIRE_DATABASE=1` to require disposable Docker PostgreSQL/PostgREST. This runs the complete migration rehearsal and Phase 5 journey in dependency order. It creates its own labeled containers, accepts no existing database connection string, and removes its containers and private temporary artifacts afterward. CI runs the same database suite with required execution. No production data is involved.
