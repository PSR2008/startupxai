# LaunchGate threat model

Phase 1 establishes contracts; this document is a required implementation plan, not a claim that future controls exist. Protected assets: private source, tenant data, credentials, billing entitlements, runner capacity and the integrity of release decisions.

| Threat | Boundary / required control | Evidence required | Phase |
| --- | --- | --- | --- |
| Malicious repository / arbitrary command execution | Never execute customer code in CONTROL PLANE or ORCHESTRATOR; isolated runner without ambient identity | Hostile build scripts cannot read host/service secrets | 3–4 |
| Path traversal / symlink escape | Canonical extraction roots, reject links/unsafe paths, bounded file access | Traversal and symlink corpus | 3 |
| Hostile archives / bombs | File/byte/depth/expansion/time ceilings before ingestion | Bounded termination fixtures | 3 |
| SSRF / DNS rebinding | Egress gateway pins validated public destination at connection time | Rebinding fixture cannot reach internal address | 4 |
| Redirect escape | Revalidate every hop; strip credentials across origins | Redirect chain reaches no unauthorized host | 4 |
| Metadata-service access | Deny metadata and link-local routes at network boundary | Cloud metadata fixture denied | 4 |
| IPv4/IPv6 private-address access | Canonical address classification including mapped addresses; deny private/loopback/link-local | Address-encoding matrix | 4 |
| Prompt injection in source | Model sees data, not tool authority; schema-only proposals and confirmed allowlisted operations | Prompt cannot schedule arbitrary operations or create failure | 1, 3–4 |
| Malicious customer target | Treat bodies, headers, downloads and browser content as hostile; bounded reads and sandbox browser | Oversized/slow/malformed response fixtures | 4, 7 |
| Credential theft | Scoped leases, brokered provider calls, exact-host injection; redaction before storage | Exfiltration fixture and artifact secret scans | 4 |
| Cross-organization access | Verified principal, membership checks, tenant FKs, RLS and scoped object access | API/SQL/storage/job negative matrix | 2 |
| Forged runner evidence | Authenticate run lease, recompute assertions, validate artifacts and bind manifest digest; never accept admission from request | Forged lease/hash/scope rejected; Phase 1 tests semantics only | 1, 4 |
| Duplicate events/jobs | Durable inbox/outbox, unique provider-account/event keys, fenced leases and transactional effects | Duplicate/crash/retry fault injection | 4, 6, 9 |
| Replay attacks | Signed provider events, dedupe and event reconciliation; replay proof bound to exact scope/seed/plan | Old evidence cannot approve/block new candidate; event replay cannot renew access | 1, 6 |
| Privilege escalation | Member cannot modify roles/authorization; owner controls sensitive policy | Direct SQL/API and role matrix | 2, 5 |
| GitHub token misuse | Selected repositories, least privilege, short-lived tokens, optional separate remediation write capability | Installation isolation/revocation tests | 3, 8 |
| Vercel preview credential leakage | Exact host header injection, strip redirects, no URL/log credentials | Cross-host redirect and trace scans | 4 |
| Payment-webhook manipulation | Raw-body signature verification, account/mode binding, transactional ledger, authoritative reconciliation | Forgery/duplicate/reordering/failed-payment tests | 6, 9 |
| Model-output trust boundary | MODEL_OUTPUT/USER_CLAIM cannot produce pass or reproduced failure; no attestation issuer | Negative outcome/gate tests | 1 |
| Quota races / cost abuse | Reserve budget atomically before work; refund/finalize idempotently; distributed rate enforcement | Concurrent requests never exceed reserved ceiling | 2, 7 |
| Evidence publication leakage | Private by default, explicit redacted publications, expiring share tokens, revocable attestations | Unauthorized/share/revocation tests | 9 |
| Deletion/retention gaps | Enumerated deletion jobs, immediate denial, credential revocation and backup expiry | End-to-end deletion/export drill | 2, 10 |

Target authorization requires control proof, authorized principal, exact hosts/ports/operations, validity window, ceilings and revocation state. Repository access is not an allowed authorization method. The schema is not DNS validation or proof verification. Runtime must additionally verify organization authority, current time, revocation and provider test mode on every run.

Initial proposed safety ceilings: HTTPS 443, two requests/second, burst five, two general concurrent requests, max ten for approved concurrency suites, 1000 requests/15 minutes per attempt, bounded body/artifact bytes and reserved AI spend. Stop on scope escape, authorization revocation, live payment mode, fixture escape or budget exhaustion. These policies will be implemented later; schema maxima are structural upper bounds, not default authorization.

Schema-valid data is not authenticated evidence. A model can fabricate JSON and hashes. The future ingestion service—not a JSON field—must establish who executed a test and validate its bytes and scope. Runner code and customer targets cannot mint trusted admission. No Phase 1 function signs or issues a LaunchGate attestation.

Current StartupX risks remain: replay-sensitive payment activation, missing capture validation, post-work usage accounting/non-atomic fallback, unrestricted usage RPC grants in migration 007, incomplete parent-ownership RLS, missing recovery-session handling, process-local rate limiting and incomplete fetch egress controls. Do not describe these as repaired by Phase 1 contracts. Historical migrations must not be edited; future repairs use new migrations and real database tests.
