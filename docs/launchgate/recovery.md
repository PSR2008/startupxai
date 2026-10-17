# Recovery and backup rehearsal

Controlled tests cover provider failure at each provisioning stage, missing or
over-budget runner, scoped credentials failing injection, unavailable artifacts,
reaper restart and stale fencing. Existing suites cover orchestrator recovery,
duplicate webhooks, database admission and exact replay. The expected result is
recoverable queued/inconclusive state, never a fabricated PASS.

The Phase 10 disposable PostgreSQL test takes `pg_dump --no-owner` of its own
launchgate_test database, restores into a new launchgate_restore database in the
same isolated container, and compares metadata/audit counts plus cross-org RLS.
The container has no network and an explicit disposable Phase 10 label. This is a
local logical restore rehearsal, not hosted disaster recovery, PITR or a tested RPO.

For a real rehearsal: provision a new dedicated staging database, restore from
an encrypted restricted backup, apply roles separately, verify migrations,
ownership, RLS, immutable evidence and grants, and revoke all restored execution
leases before enabling workers. Keep outbound provider writes disabled until
restored identities and resource ownership are reconciled. Never restore over
production or reuse production credentials in staging.

LOCAL_RESTORE_VERIFIED is recorded only after the executable database test passes.
HOSTED_RESTORE_UNVERIFIED remains explicit. Backup retention, encryption keys,
RPO/RTO and managed restore evidence require an operator-owned environment.
