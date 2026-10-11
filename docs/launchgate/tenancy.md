# Phase 2 tenancy and data foundation

## Scope and migration strategy

Apply `migrations/014_launchgate_tenancy.sql` followed by `015_launchgate_commands.sql` with the trusted database migration identity. Both are transactional, forward-only migrations; use a migration ledger, not repeated manual execution. Historical migrations 001-013 are unchanged. Roll forward with a new migration after deployment, never edit deployed history. No migration was applied to a customer or production Supabase project during implementation.

Eight `public.lg_*` tables coexist with StartupX. The public prefix works with the existing Supabase/PostgREST exposed schema without changing project configuration. Non-API helpers live in `launchgate_private`, which must never be added to exposed schemas. SQL functions have empty search paths, fully qualified references, explicit execution grants and no caller-controlled dynamic SQL. Apply as a trusted role with RLS bypass (the Supabase migration role); ordinary clients must never own tables/functions or receive that credential. PostgreSQL superusers remain outside the tenant isolation boundary.

| Table | Purpose |
| --- | --- |
| lg_organizations | Stable UUID identity, name, creator, ACTIVE/DELETION_PENDING/DELETED |
| lg_organization_memberships | Unique organization/user, explicit role, ACTIVE/DISABLED/REMOVED |
| lg_projects | Organization-owned projects, stable UUID, creator, status |
| lg_audit_events | Append-oriented security history with actor/role snapshot |
| lg_secret_references | Typed metadata and private opaque backend locator; no secret bytes |
| lg_retention_policies | Organization defaults and optional project metadata, category/days |
| lg_deletion_requests | Owner-authorized organization cleanup lifecycle |
| lg_deletion_tasks | Bounded cleanup categories and durable task state |

No invitations, project memberships, execution, evidence, finding, invariant, integration, billing or artifact persistence tables are introduced. Members are added by an existing registered user's UUID. There is no email lookup/delivery or implicit signup. Project access deliberately inherits organization membership. Restricting individual projects is a future explicit schema/policy change; there is no misleading project-role API now.

## Authorization and role model

The server verifies the bearer token with Supabase `auth.getUser`. A runtime WeakSet marks principals created by that verified path; deserialized objects and arbitrary user IDs cannot satisfy the authorization helpers. An injectable verifier/session factory is a trusted internal test dependency only. It is never chosen by request data.

The request-scoped database client uses the anon key and the same caller bearer header. It never imports the legacy service-role client. RLS evaluates the authenticated database identity independently of application checks. A stale application authorization result cannot authorize a write: every command repeats membership/status/role checks under an organization row lock.

| Operation | VIEWER | DEVELOPER | ADMIN | OWNER |
| --- | --- | --- | --- | --- |
| Read active organization/projects/retention | yes | yes | yes | yes |
| Create projects | no | yes | yes | yes |
| Manage developer/viewer membership | no | no | yes | yes |
| Manage admin/owner membership | no | no | no | yes |
| Transfer own ownership | no | no | no | yes |
| Read audit/secret metadata; edit retention | no | no | yes | yes |
| Request organization deletion | no | no | no | yes |

All authenticated users may create an organization and become its first owner. Membership lists are organization-readable in SQL; the management HTTP list requires ADMIN. Names are labels, never authorization identifiers. StartupX `user_roles`, `user_plans`, `analyses`, `validation_projects` and `evidence_items` grant no LaunchGate authority.

Owners can add another owner. Transfer promotes an active same-organization successor first, then demotes the initiating owner to ADMIN in one transaction. Multiple owners are allowed. ADMIN cannot change an ADMIN/OWNER or grant either role. A database trigger prevents removal, disabling or demotion of the final active owner. Commands lock the organization before inspecting membership; the integration suite races two owner demotions and proves one fails. Membership identity is immutable; removal is a soft status change. Disabled/removed members lose access immediately in new database statements.

## RLS, grants and privileged commands

All eight tables enable and force RLS. Authenticated users have scoped SELECT only. Secret metadata has a column-level SELECT grant excluding `backend_reference`. There are no INSERT/UPDATE/DELETE policies or direct mutation grants, even for owners. Role-sensitive writes are the authenticated security-definer commands below, not generic service-role queries. This also guarantees that an audit write and the associated business write commit or roll back together.

The private stable membership predicate avoids recursive membership policies. Its only user-callable result is a boolean based on `auth.uid()`. The public security-membership read command returns only the caller's active ADMIN/OWNER membership for active/pending organizations, allowing limited audit/deletion status access after normal access has stopped.

| Command | Authorization and boundary |
| --- | --- |
| lg_create_organization | authenticated identity; atomic organization/OWNER/audit |
| lg_manage_member | locked org; OWNER/limited ADMIN; last-owner trigger |
| lg_create_project | locked org; DEVELOPER or above |
| lg_set_retention | locked org; ADMIN or above; composite project FK |
| lg_request_deletion | locked org; OWNER only; status/tasks/audit transaction |
| lg_read_security_membership | read-only, own ADMIN/OWNER membership only |

PUBLIC/anon/service_role execution is revoked on the new commands. The migration also explicitly revokes blanket service-role table grants, including grants inherited from Supabase defaults. No background service client or worker credential is introduced. BYPASSRLS does not itself grant table access; tests separately demonstrate that granting SELECT to a BYPASSRLS role would bypass isolation. A later worker must receive narrowly reviewed operations, not unrestricted DML.

Composite ownership pattern: put `UNIQUE (organization_id,id)` on each tenant parent, then use `FOREIGN KEY (organization_id,parent_id) REFERENCES parent(organization_id,id)`. Use it even when IDs are globally unique. Secret/retention project references, deletion-task request references and audit membership references use this pattern. Tenant parents use RESTRICT rather than browser-triggered cascade deletion. Audit actor snapshots remain tied to retained membership tombstones.

## Audit, secrets and retention

Successful security mutations generate an event with organization, verified user, membership ID, pre-mutation role, operation, target, correlation UUID, SUCCEEDED outcome and timestamp. Correlation UUIDs are generated by the HTTP server; direct RPC callers may supply their own UUID, which is a tracing hint, never authority. Safe metadata is currently constrained to `{}` so secrets/free-text payloads cannot enter it. Names, credentials, payment data and repository contents are not copied to audit. Users cannot insert, update or delete audit rows; a trigger additionally rejects updates/deletes by ordinary privileged DML. A database administrator can change the schema, so this is not a cryptographically tamper-proof ledger.

Audit reads require ADMIN/OWNER. Failed commands roll back atomically and return safe errors; **durable denied-attempt telemetry is not implemented**. Adding it requires a separate trusted recording path because inserts inside the rejected transaction would also roll back. Product analytics is not substituted for security history.

Secret rows contain enums, IDs and lifecycle timestamps, never plaintext or encrypted secret material. The backend locator is an opaque UUID, excluded by SQL column permissions and the HTTP projection. No browser can create/register arbitrary references. The `ManagedSecretBackend` interface is a future trusted-worker boundary, not a KMS implementation; no resolve/store/rotate HTTP endpoint exists. A future backend must authenticate leases, verify current org/project/purpose/revocation, audit use and constrain the lifetime of resolved bytes. Its generic callback cannot itself guarantee zeroization or prevent trusted code from copying bytes.

Retention metadata supports SOURCE_SNAPSHOTS, ARTIFACTS, FINDINGS, AUDIT_EVENTS and CREDENTIALS, 1-3650 whole days. One organization default and one override per project/category are allowed. Shorter customer settings are accepted. An eventual scheduler must resolve project override over organization default, define defaults for absent categories, apply legal holds and document backup expiry. There is **no retention execution or legal-policy decision engine** here; writing metadata does not assert that data was erased.

## Deletion lifecycle

An OWNER request immediately creates an AUTHORIZED request, marks the organization DELETION_PENDING and creates seven REQUESTED tasks: source snapshots, artifacts, findings, credentials, database rows, backup expiry and legal-retention review. It does not perform cascading destruction. Normal organization/project/membership/secret/retention reads and all new commands stop. Remaining active ADMIN/OWNER identities may inspect audit and deletion status only. A second request is rejected; the existing request is available through GET.

Future worker progression: AUTHORIZED -> RUNNING -> COMPLETED/FAILED; FAILED may retry RUNNING. Individual tasks progress REQUESTED -> RUNNING -> COMPLETED/FAILED, with FAILED -> RUNNING retry. Task updates require a RUNNING parent. Completion requires all seven tasks complete and then tombstones the organization DELETED. Invalid transitions and reassociation are rejected in the database. No cancellation/reopening route exists. Task retry leases, execution, storage cleanup and external credential revocation are deliberately not implemented.

Audit/membership/organization tombstones remain linked, with RESTRICT FKs. Legal-retention review is an explicit blocking task, not a claim that records are legally required. A future worker must move any records that actually require legal retention to a separately controlled retention store and record expiry before completing that task; backups require their own expiry evidence. Phase 2 does not claim complete deletion, legal compliance, or erasure from backups. Superuser-marked test task completion is a state-machine test only.

## HTTP surface

All routes are under `/api/v1`, bearer authenticated, server-only, `no-store`, and use the existing safe API error contract plus a server correlation UUID. JSON bodies are strict and limited to 16 KiB. No cookie/session-derived tenant ID or browser-submitted role is trusted. Lists are bounded to the first 100 rows (deletion request: one); pagination is deferred and this is not an export API. Unsupported methods/paths produce a safe validation error; no UI was added.

| Route | Methods |
| --- | --- |
| /organizations | GET, POST `{name}` |
| /organizations/:id | GET |
| /organizations/:id/members | GET, POST `{userId,role}` |
| /organizations/:id/members/:membershipId | PATCH `{role,status}`, DELETE (soft removal) |
| /organizations/:id/ownership-transfer | POST `{membershipId}` |
| /organizations/:id/audit | GET |
| /organizations/:id/secret-references | GET (safe metadata) |
| /organizations/:id/retention-policies | GET, PUT `{projectId?,category,durationDays}` |
| /organizations/:id/deletion-requests | GET (with tasks), POST `{}` |
| /projects | GET `?organizationId=uuid`, POST `{organizationId,name}` |
| /projects/:id | GET |

PostgREST returns row results as arrays by default; command adapters request `.single()` and the security-membership adapter uses `.maybeSingle()`. See [PostgREST representation semantics](https://postgrest.org/en/latest/references/api/resource_representation.html). The disposable HTTP tests check actual singular RPC responses as well as JWT-to-RLS enforcement.

## Database testing and types

Run `npm run test:database`. The harness checks Docker and creates its own uniquely named PostgreSQL 17 container, pinned by image digest. It accepts **no database URL**, mounts no workspace, publishes no ports and uses Docker `--network none`. PostgREST runs in the same isolated network namespace; HTTP tests call it from inside the PostgreSQL container. No production Supabase credentials are read. Temporary roles, users and a random local JWT signing key exist only in this test environment. Containers/volumes are removed afterward; image cache remains.

The SQL harness implements the small `auth.users`/`auth.uid()` contract and runs tests as authenticated/anon/service_role, not as superuser masquerading as RLS. Fixture insertion, catalog checks and explicit privileged-behavior tests use the migration identity separately. All historical migrations run before the upgrade; a populated legacy row and policy snapshot are preserved. A second empty database tests standalone LaunchGate migration application. This is not a production snapshot replay or a complete Supabase stack. Hosted GoTrue token verification, hosted project configuration and full Next-to-Supabase HTTP behavior still require staging validation.

If Docker is absent, database tests are explicitly skipped with `BLOCKED_BY_ENVIRONMENT`; never report these as passed. CI sets `LAUNCHGATE_REQUIRE_DATABASE=1` so unavailable Docker fails the job. Image pull or migration failures fail, rather than masquerading as skips. HTTP test fixtures use pinned PostgREST 12.2.3; this test-only image is not a deployed production dependency.

Narrow types in `src/server/launchgate/domain.ts` are manually maintained, explicitly not generated. Supabase CLI is absent locally; no fabricated generated schema is checked in. Before staging, generate types from the actually migrated staging/local Supabase database and review the diff. The schema and real SQL tests are the current authority.
