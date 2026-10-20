# Dedicated staging qualification

Phase 13 has no configured, approved external staging assets. Nothing has been deployed, purchased, published or charged. StartupX production is not a test asset. See [qualification matrix](live-qualification-matrix.md).

## Safe entry point

`npm.cmd run launchgate:qualify` reads configuration presence/format, prints classifications only, and saves a report under ignored `.launchgate/phase13/`. It does not probe providers. This is local availability evidence, not a hosted registry write or live qualification.

`--manifest <path>` accepts strict operator-owned JSON, maximum 16 KiB, with no secrets or executable code:

| Field | Required value |
| --- | --- |
| schemaVersion / environment / dedicated | `1` / `staging` / `true` |
| organizationId / projectId | Dedicated LaunchGate organization/project UUIDs |
| stagingOrigin | Exact HTTPS origin on `*.vercel.app` |
| supabaseOrigin | Exact dedicated HTTPS origin on `*.supabase.co` |
| repositoryId / repository | Numeric GitHub ID / `owner/name` |
| vercelProjectId | Exact `prj_...` ID |
| artifactNamespace / secretNamespace | Separate names beginning `launchgate-staging-` |
| configurationRevision / credentialRevision / permissionRevision | UUIDs replaced on corresponding changes |
| sandboxVersion | Approved provider adapter version |
| approvedCapabilities | Explicit subset of `qualificationChecks` names |
| allowTestPullRequest | `false` unless separate test PR permission is approved |
| paymentMode | `TEST_ONLY` |

The command registers **no live qualification drivers**. Approved configured capabilities without a driver produce NOT_IMPLEMENTED, never VERIFIED. Trusted operator code must supply a `QualificationDriver` to `qualify()`; provider contracts alone are insufficient. Drivers must exercise every required check, bind evidence to organization/project/configuration, honor the abort signal, retain redacted evidence by digest, and confirm cleanup. Repository-provided code, arbitrary endpoints and dynamic imports are not accepted.

After the dedicated database exists and migrations are applied, use `npm.cmd run launchgate:qualify -- --manifest <path> --persist-staging` to persist truthful blocked/unimplemented results. This requires both environment selectors to be staging, the exact approved Supabase origin, and a configured service credential. It never resets a database. No hosted write was attempted here.

## Exact missing-asset setup

Never paste secret values into chat, manifests or documentation. Load them only into the staging control-plane secret environment.

1. **GitHub:** create/approve a dedicated synthetic test repository and record its numeric ID. Install an analysis App only there, with Metadata/Contents read and Checks write, no Contents write. Set `LAUNCHGATE_GITHUB_APP_ID`, `LAUNCHGATE_GITHUB_CLIENT_ID`, `LAUNCHGATE_GITHUB_CLIENT_SECRET`, `LAUNCHGATE_GITHUB_PRIVATE_KEY`, `LAUNCHGATE_GITHUB_WEBHOOK_SECRET`, `LAUNCHGATE_GITHUB_REDIRECT_URI`. Register staging callback/webhook routes; test signed delivery, dedupe, exact SHA, Checks and revocation.
2. **Optional remediation:** install a separate test App with Contents/Pull requests write. Set `LAUNCHGATE_REMEDIATION_APP_ID`, `LAUNCHGATE_REMEDIATION_PRIVATE_KEY`; activate the separate remediation capability and explicitly approve a test PR. Never auto-merge. Prove revoked write authority cannot write while analysis remains usable.
3. **Vercel:** approve a separate staging project connected only to the test repository. Set server-only `LAUNCHGATE_VERCEL_CONNECTIONS` JSON entries with `projectId`, `organizationId`, `credentialReference` (UUIDs), `accountId` (`team_...`), `providerProjectId` (`prj_...`) and `token`. Use bounded protected-preview access. Never reuse production projects or pass control credentials to runners.
4. **Supabase:** approve a separate empty test project. Confirm its project reference before migrations; apply all migration files 001 through 037 in filename order through its trusted migration connection. Do not reset an existing project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; configure staging Auth redirects. Exercise sessions, RLS, tenant/service isolation, audit, upgrade and reconnection; generate/compare types from that actual schema. Local fixture types do not qualify a hosted schema.
5. **Storage:** approve a private staging bucket/namespace and workload identity; implement/register the managed artifact adapter. Set `LAUNCHGATE_ARTIFACT_BACKEND=managed`, `LAUNCHGATE_ARTIFACT_PRIVATE=1`, `LAUNCHGATE_ARTIFACT_ENCRYPTION=PROVIDER_KMS`. Concrete cloud identity/bucket configuration belongs to the selected adapter; none is bundled. Prove hash/scoped access, signed expiry, cross-tenant denial, delete and retention.
6. **Secrets:** approve a managed staging namespace/workload identity; implement/register its adapter. Set `LAUNCHGATE_SECRET_BACKEND=managed`. Exercise put/lease/use/rotate/revoke/delete. Store references only in DB. Advance credential revisions when external reference versions change.
7. **Sandbox:** select an approved provider/account and explicit infrastructure budget before provisioning. Implement/register production transport and egress enforcement. Set `LAUNCHGATE_SANDBOX_BACKEND=production`, `LAUNCHGATE_UNRESTRICTED_EGRESS=0`, `LAUNCHGATE_RUNNER_PRIVATE_KEY` (separate staging Ed25519 key). Prove every sandbox checklist control against only approved targets. Local Docker/Node is not qualification evidence.
8. **Environment:** set `LAUNCHGATE_ENVIRONMENT=staging`, `LAUNCHGATE_RESOURCE_ENVIRONMENT=staging`, `LAUNCHGATE_VERIFICATION_PAYMENT_MODE=TEST_ONLY`. Separate database, signing keys, secrets, artifacts, test credentials and preferably installation. Deploy control plane and worker separately. Wire safe operational events to internal metrics for queue/run time, retries, integration/cleanup failures, leases and budget denials.
9. **Stripe:** configure test credentials/webhook only: `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET`. Live keys are rejected by inventory. Use synthetic test objects; zero live payments.
10. **Razorpay:** configure test credentials/webhook only: `RAZORPAY_KEY_ID` (`rzp_test_...`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Test authoritative amount, capture and signed replay. Record unsupported safe API operations.
11. **AI:** configure existing `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` only if an approved account exists. A trusted diagnostic driver must verify model availability/current pricing, bound input/output and all retries, and reserve worst-case cost before any call. Use ONE authoritative staging budget database for this phase. Each provider is limited to 100,000 micro-USD ($0.10) total, not per call/organization. Never reset/switch the ledger for another allowance. If cost cannot be proved, do not call. No purchase/subscription is authorized.
12. **Distribution:** after staging works, use the built Windows CLI against its exact origin and a scoped CI credential in an actual workflow in the test repo. Exercise all decision exits, token masking and summary. Assess only the approved public test repository. Create an explicit test share, access externally, revoke, verify denial and badge supersession. Do not publish CLI or Action. macOS/Linux require separate actual qualification.

## Controlled journey and recovery

Keep the known tenant defect only in the dedicated synthetic test app. Bind defective commit A to its immutable preview, authorize that target, reproduce and obtain BLOCK. With explicit approval propose a bounded fix (optional PR), create fixed commit B/new preview, replay exact evidence and regression coverage, then obtain SHIP and an exact-B Check. Prove A cannot approve B. A missing dependency blocks subsequent steps.

On approved test assets revoke installation/CI/share credentials, interrupt a DB connection and runner, and exercise reaper cleanup. Simulate rate limits through the adapter where live triggering is unsafe; label simulation separately. Inventory identities, leases, reservations, sandboxes and artifact objects before/after. Delete only named resources whose recorded ownership matches this qualification.
