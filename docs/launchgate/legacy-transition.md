# StartupX transition

StartupX is archived by annotated tag `startupxai-final`, resolving to `a61ba8c8873fa0eedf48879f90aa4869f8991b8f`. `main` remains untouched. Implementation is confined to `launchgate-rebuild`; Phase 1 makes no commit/push/history changes.

Historical migrations 001–013 are immutable. No LaunchGate migrations exist in Phase 1. Before later forward migrations, inspect the deployed schema/grants and reconcile README-era SQL with migration history. Restore credentials through the user's secure process; placeholders are expected locally and must never be treated as working integrations.

StartupX reports, market scores and founder evidence must never be reinterpreted as LaunchGate deterministic observations. New organization/project/invariant/run entities will be separate. Existing payment records retain their meaning and provider identifiers.

Marketing, authentication UI, analysis/generation tools, billing UI, evidence workspace and API routes remain through the foundation phase. Existing tests are retained. Retirement requires functioning replacement surfaces, explicit export/retention policy, redirects where appropriate, compatibility verification and rollback plans. Do not bulk rename/delete routes now.

Confirm active customers, purchased periods, refunds, data ownership, export and retention obligations before any destructive migration. Personal-organization backfill or legacy credits require a documented policy. No automatic inference of organization roles from the old internal-user entitlement bypass.

Phase 1 intentionally changes only health semantics, server configuration validation, shared bearer-principal resolution and tooling/dependency foundations. Invalid/placeholding Supabase configuration now returns unavailable instead of making a useless network request. `/api/health` retains HTTP 200 for liveness, exposes aggregate configuration state, and no longer publishes individual provider-presence flags. `/internal` remains reachable but its legacy checks list is empty; UI modernization is deferred. No claim of integration connectivity is made.

The old payment, quota, RLS and recovery defects from Phase 0 remain tracked. They need explicit remediation in later phases; the continued StartupX UI is not a production-security certification.

## Phase 2 coexistence

Phase 1 was already committed as `ef5f791` when Phase 2 began on a clean `launchgate-rebuild`. Phase 2 makes no commits or pushes. New migrations 014/015 create only LaunchGate-prefixed tables/functions and a private helper schema; historical migrations 001-013 are unchanged. New `/api/v1` endpoints coexist with all existing StartupX endpoints and pages. The shared principal helper now tracks runtime verification provenance without changing its existing user ID/origin response.

Disposable database tests apply every historical migration, insert a representative analysis and legacy admin role, capture existing policies, then apply 014/015. They verify the row/policies survive and that the old admin role grants no LaunchGate access. This is synthetic upgrade evidence, not an assertion that every deployed README-era schema has been reconciled. Inspect staging schema/grants before applying the migrations to an existing Supabase project.

No StartupX users are auto-enrolled, no billing state is repurposed, and no old evidence becomes trusted LaunchGate evidence. The new database path does not import the legacy admin client or rely on old owner filters. The inherited migration 007 RPC grants, payment replay/capture risks, usage accounting, recovery and fetch/rate-limit risks remain unresolved and must be addressed before production security claims.
