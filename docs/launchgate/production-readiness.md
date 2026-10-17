# Production readiness

LaunchGate is **not production-ready**. This phase provides tested boundaries and
operational contracts; cloud adapters and live qualification remain pending.

Liveness means the process responds. Configuration means typed configuration is
valid. Integration verification means recent legitimate live evidence exists.
Production readiness additionally requires every mandatory capability: production
sandbox, managed secrets, private artifacts, hosted database, GitHub, Vercel and
the staging E2E. Payment/AI capabilities retain individual status and cannot be
advertised as verified simply because these mandatory services work.

States are VERIFIED, UNVERIFIED, BLOCKED_BY_ENVIRONMENT, DEGRADED or NOT_IMPLEMENTED.
Public output is aggregate and contains no provider secrets, resource IDs or
account details. Internal records are environment- and organization-scoped.

## Deployment topology

Control plane serves authenticated browser APIs and validated webhooks. A separate
orchestrator uses a server-only database credential, managed secrets and provider
control APIs. Postgres and object storage are private administrative services.
Sandbox attempts receive only short-lived execution/target credentials and can
reach the authorized target through an enforced gateway. Evidence goes through
the existing authenticated ingestion boundary, never direct database access.
Do not expose unauthenticated orchestrator/provider administration endpoints.

Use distinct database, bucket, secret namespace, signing keys, provider accounts
and preferably App installations in development, test, staging and production.
`LAUNCHGATE_ENVIRONMENT` and `LAUNCHGATE_RESOURCE_ENVIRONMENT` must match. Managed
adapters must independently verify their resource tags and workload identity;
configuration strings do not prove cloud separation.

The configuration validator refuses local/test backends in staging/production,
missing signing-key configuration, placeholder GitHub secrets, public or
unencrypted artifacts, unrestricted egress and live-mode verification payments.
Local remediation startup is explicitly refused in staging/production. No
production sandbox transport is registered by default, so startup remains closed.

Operator settings include LAUNCHGATE_SANDBOX_BACKEND=production,
LAUNCHGATE_SECRET_BACKEND=managed, LAUNCHGATE_ARTIFACT_BACKEND=managed,
LAUNCHGATE_ARTIFACT_PRIVATE=1, LAUNCHGATE_ARTIFACT_ENCRYPTION=PROVIDER_KMS,
LAUNCHGATE_VERIFICATION_PAYMENT_MODE=TEST_ONLY, and
LAUNCHGATE_UNRESTRICTED_EGRESS=0. These settings alone do not create a provider or
qualify it. Never put secret values in client-facing environment variables.
