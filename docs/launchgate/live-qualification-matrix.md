# Phase 13 live qualification matrix

Observed 2026-10-20. No usable provider credentials or approved dedicated assets. No live requests, hosted writes or diagnostic spend occurred.

| Capability | Current status | Prerequisite |
| --- | --- | --- |
| github.live | BLOCKED_BY_ENVIRONMENT | Approved repository/analysis App |
| github.checks.live | BLOCKED_BY_ENVIRONMENT | Test installation/Checks write |
| github.remediation.live | UNVERIFIED | Optional separate approved write authority |
| vercel.live | BLOCKED_BY_ENVIRONMENT | Dedicated project/connection |
| supabase.hosted | BLOCKED_BY_ENVIRONMENT | Dedicated hosted database |
| artifact_store.managed | BLOCKED_BY_ENVIRONMENT | Private namespace/identity/adapter |
| secret_store.managed | BLOCKED_BY_ENVIRONMENT | Managed namespace/identity/adapter |
| sandbox.production | BLOCKED_BY_ENVIRONMENT | Approved provider/account/budget/transport |
| stripe.test | BLOCKED_BY_ENVIRONMENT | Test credentials/webhook |
| razorpay.test | BLOCKED_BY_ENVIRONMENT | Test credentials/webhook |
| openai.live | BLOCKED_BY_ENVIRONMENT | Existing credential/proven cost bound |
| anthropic.live | BLOCKED_BY_ENVIRONMENT | Existing credential/proven cost bound |
| staging.full_e2e | BLOCKED_BY_ENVIRONMENT | All required live dependencies |
| staging.deployment | BLOCKED_BY_ENVIRONMENT | Separate deployed services |
| staging.recovery | BLOCKED_BY_ENVIRONMENT | Real staging services |
| staging.cleanup | BLOCKED_BY_ENVIRONMENT | Real staging services |
| cli.windows.staging | BLOCKED_BY_ENVIRONMENT | Staging server |
| github.action.live | BLOCKED_BY_ENVIRONMENT | Actual approved repository workflow |
| assessment.external | BLOCKED_BY_ENVIRONMENT | Approved public test repository |
| sharing.external | BLOCKED_BY_ENVIRONMENT | Externally reachable test project |

macOS/Linux CLI remains UNVERIFIED. Local Windows tests do not qualify staging. No row is VERIFIED.

Local contracts/checklists and admission rules are implemented. No concrete live qualification drivers are registered; supplying assets alone results in NOT_IMPLEMENTED for approved capabilities until trusted drivers exist. The local report persists availability results; the unavailable hosted registry was not written. See [exact setup](staging.md).

Framework evidence expires after one hour (DB maximum 24 hours). Changes to manifest/configuration, credential material, permission revision or sandbox version invalidate evidence. External revocation requires webhook/operator invalidation and requalification; no provider permission polling is claimed.
