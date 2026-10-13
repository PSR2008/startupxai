import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";

// No connection string accepted: this suite creates its OWN isolated Docker database.
// auth.uid() is the minimal Supabase SQL identity contract, not an Auth/JWT emulator.
const docker = (args: string[], input?: string) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000, windowsHide: true });
const available = docker(["info", "--format", "{{.ServerVersion}}"]);
const blocked = available.status !== 0;
const container = `launchgate-rls-${randomUUID()}`;
const postgresImage = "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24";
const restContainer = `${container}-rest`;
const restImage = "postgrest/postgrest:v12.2.3@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401";
// Ephemeral local-only signing key. Not a Supabase credential or integration claim.
const testSigningKey = randomUUID() + randomUUID();
let restStarted = false;
let started = false;
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1), admin = uid(2), developer = uid(3), viewer = uid(4), outsider = uid(5), candidate = uid(6);
const org = uid(100), other = uid(101), project = uid(200), otherProject = uid(201), correlation = uid(300);
const bootstrap = `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon,authenticated,service_role TO authenticator;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated,anon,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon,service_role;`;
function raw(sql: string, database = "launchgate_test") {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "postgres", "-d", database], sql);
}
function execute(sql: string, database?: string) {
  const result = raw(sql, database); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function transaction(user: string, sql: string, role = "authenticated") {
  return `BEGIN; SET LOCAL ROLE ${role}; SET LOCAL request.jwt.claim.sub='${user}'; ${sql}; ROLLBACK;`;
}
function query(user: string, sql: string, role?: string) { return execute(transaction(user, sql, role)); }
function http(user: string, path: string, input?: unknown, single = false) {
  const payload = Buffer.from(JSON.stringify({ sub: user, role: "authenticated", exp: Math.floor(Date.now()/1000)+300 })).toString("base64url");
  const unsigned = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${payload}`;
  const token = `${unsigned}.${createHmac("sha256",testSigningKey).update(unsigned).digest("base64url")}`;
  return docker(["exec",container,"wget","-qO-","--header",`Authorization: Bearer ${token}`,
    ...(single ? ["--header","Accept: application/vnd.pgrst.object+json"] : []),
    ...(input === undefined ? [] : ["--header","Content-Type: application/json","--post-data",JSON.stringify(input)]),`http://127.0.0.1:3000/${path}`]);
}
function denied(user: string, sql: string, code = "42501", role?: string) {
  const result = raw(transaction(user, sql, role)); assert.notEqual(result.status, 0, result.stdout); assert.match(result.stderr, new RegExp(code));
}
const rpcMember = (action: string, membership: string | null, role: string | null, status = "ACTIVE", user = candidate) =>
  `SELECT id FROM public.lg_manage_member('${org}','${action}','${user}',${membership ? `'${membership}'` : "NULL"},${role ? `'${role}'` : "NULL"},'${status}','${correlation}')`;
const memberId = (n: number) => uid(400 + n);
function dbtest(name: string, fn: () => void | Promise<void>) { test(name, { skip: blocked ? "BLOCKED_BY_ENVIRONMENT: Docker engine unavailable" : false }, fn); }

before(async () => {
  if (blocked) {
    if (process.env.LAUNCHGATE_REQUIRE_DATABASE === "1") throw new Error("BLOCKED_BY_ENVIRONMENT: Docker engine unavailable");
    return;
  }
  const run = docker(["run", "--detach", "--name", container, "--label", "launchgate.disposable=true", "--network", "none", "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_DB=launchgate_test", postgresImage]);
  assert.equal(run.status, 0, run.stderr); started = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    // The image's temporary initialization server accepts Unix sockets but not TCP.
    // Wait for the final server, otherwise bootstrap can race its shutdown.
    if (docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "launchgate_test"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, "disposable PostgreSQL did not start");
  execute(bootstrap);
  for (const file of readdirSync("migrations").filter(file => /^0(0|1[0-3])/.test(file) && file.endsWith(".sql")).sort()) execute(readFileSync(`migrations/${file}`, "utf8"));
  execute(`INSERT INTO public.user_roles(user_id,role) VALUES('${outsider}','admin');
    INSERT INTO public.analyses(user_id,session_id,engine_type,input_data) VALUES('${owner}','phase2-legacy','test','{"sentinel":true}');`);
  execute(`CREATE TABLE public.test_legacy_policies AS SELECT * FROM pg_policies WHERE tablename NOT LIKE 'lg_%';`);
  execute(readFileSync("migrations/014_launchgate_tenancy.sql", "utf8"));
  execute(readFileSync("migrations/015_launchgate_commands.sql", "utf8"));
  execute(`INSERT INTO auth.users(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,6) n;
    INSERT INTO public.lg_organizations(id,name,created_by) VALUES('${org}','Alpha','${owner}'),('${other}','Beta','${outsider}');
    INSERT INTO public.lg_organization_memberships(id,organization_id,user_id,role) VALUES
      ('${memberId(1)}','${org}','${owner}','OWNER'),('${memberId(2)}','${org}','${admin}','ADMIN'),
      ('${memberId(3)}','${org}','${developer}','DEVELOPER'),('${memberId(4)}','${org}','${viewer}','VIEWER'),
      ('${memberId(5)}','${other}','${outsider}','OWNER');
    INSERT INTO public.lg_projects(id,organization_id,name,created_by) VALUES('${project}','${org}','Alpha project','${owner}'),('${otherProject}','${other}','Beta project','${outsider}');
    INSERT INTO public.lg_secret_references(organization_id,project_id,kind,provider,backend_reference,purpose,created_by)
      VALUES('${org}','${project}','PROVIDER_CREDENTIAL','MANAGED_SECRET_BACKEND','${uid(700)}','INTEGRATION','${owner}');`);
  const rest = docker(["run","--detach","--name",restContainer,"--label","launchgate.disposable=true","--network",`container:${container}`,
    "--env","PGRST_DB_URI=postgresql://authenticator@127.0.0.1:5432/launchgate_test","--env","PGRST_DB_SCHEMAS=public","--env","PGRST_DB_ANON_ROLE=anon","--env",`PGRST_JWT_SECRET=${testSigningKey}`,restImage]);
  assert.equal(rest.status,0,rest.stderr); restStarted=true;
  let restReady=false;
  for (let i=0;i<40;i++) {
    if (http(owner,"lg_organizations?select=id").status===0) { restReady=true; break; }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(restReady,"local PostgREST did not start");
});
after(() => {
  if (restStarted) assert.equal(docker(["rm","--force",restContainer]).status,0);
  if (started) {
    const label = docker(["inspect", "--format", '{{index .Config.Labels "launchgate.disposable"}}', container]);
    assert.equal(label.stdout.trim(), "true");
    assert.equal(docker(["rm", "--force", "--volumes", container]).status, 0);
  }
});

dbtest("fresh LaunchGate schema applies independently of StartupX tables", () => {
  execute("CREATE DATABASE launchgate_fresh");
  // Roles are cluster-wide; only create per-database auth objects.
  execute(bootstrap.slice(bootstrap.indexOf("CREATE SCHEMA auth")), "launchgate_fresh");
  execute(readFileSync("migrations/014_launchgate_tenancy.sql", "utf8"), "launchgate_fresh");
  execute(readFileSync("migrations/015_launchgate_commands.sql", "utf8"), "launchgate_fresh");
  assert.equal(execute("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'lg_%'", "launchgate_fresh"), "8");
});
dbtest("upgrade preserves populated legacy data and every legacy policy", () => {
  assert.equal(execute("SELECT input_data->>'sentinel' FROM analyses WHERE session_id='phase2-legacy'"), "true");
  assert.equal(execute("SELECT count(*) FROM ((SELECT * FROM test_legacy_policies EXCEPT SELECT * FROM pg_policies WHERE tablename NOT LIKE 'lg_%') UNION ALL (SELECT * FROM pg_policies WHERE tablename NOT LIKE 'lg_%' EXCEPT SELECT * FROM test_legacy_policies)) d"), "0");
});
dbtest("all eight tenant tables force RLS", () => assert.equal(execute("SELECT count(*) FROM pg_class WHERE relname LIKE 'lg_%' AND relkind='r' AND relrowsecurity AND relforcerowsecurity"), "8"));
dbtest("authenticated create atomically assigns OWNER and durable audit", () => {
  const result = query(candidate, `SELECT id FROM lg_create_organization('New org','${correlation}'); SELECT role FROM lg_organization_memberships WHERE user_id='${candidate}'; SELECT operation||':'||actor_role FROM lg_audit_events WHERE actor_user_id='${candidate}'`);
  assert.match(result, /OWNER\nORGANIZATION_CREATED:OWNER$/);
});
dbtest("anonymous cannot create organization", () => denied("", `SELECT lg_create_organization('No','${correlation}')`, "42501", "anon"));
dbtest("missing authenticated identity cannot create organization", () => denied("", `SELECT lg_create_organization('No','${correlation}')`));
dbtest("outsider guessed organization read returns no rows", () => assert.equal(query(outsider, `SELECT count(*) FROM lg_organizations WHERE id='${org}'`), "0"));
dbtest("list without owner filter still isolates organizations", () => assert.equal(query(outsider, "SELECT name FROM lg_organizations"), "Beta"));
for (const statement of [`UPDATE lg_organizations SET name='hijack' WHERE id='${org}'`, `DELETE FROM lg_organizations WHERE id='${org}'`, `INSERT INTO lg_organizations(name,created_by) VALUES('forged','${outsider}')`]) {
  dbtest(`browser direct organization mutation denied: ${statement.split(" ")[0]}`, () => denied(outsider, statement));
}
dbtest("owner can add each allowed role with audit", () => {
  for (const role of ["OWNER", "ADMIN", "DEVELOPER", "VIEWER"]) assert.match(query(owner, `${rpcMember("ADD", null, role)}; SELECT operation FROM lg_audit_events`), /MEMBER_ADDED$/);
});
dbtest("membership unique per org/user", () => denied(owner, rpcMember("ADD", null, "VIEWER", "ACTIVE", viewer), "23505"));
dbtest("same user can belong to multiple organizations", () => assert.ok(query(owner, rpcMember("ADD", null, "VIEWER", "ACTIVE", outsider))));
dbtest("viewer cannot add memberships", () => denied(viewer, rpcMember("ADD", null, "VIEWER")));
dbtest("developer cannot promote self via RPC", () => denied(developer, rpcMember("UPDATE", memberId(3), "OWNER")));
dbtest("admin cannot promote self to owner", () => denied(admin, rpcMember("UPDATE", memberId(2), "OWNER")));
dbtest("admin cannot grant ownership to another user", () => denied(admin, rpcMember("ADD", null, "OWNER")));
dbtest("admin can manage developer/viewer", () => assert.ok(query(admin, rpcMember("UPDATE", memberId(4), "DEVELOPER"))));
dbtest("direct DB self escalation denied", () => denied(developer, `UPDATE lg_organization_memberships SET role='OWNER' WHERE user_id='${developer}'`));
dbtest("last owner cannot be removed", () => denied(owner, rpcMember("REMOVE", memberId(1), null), "23514"));
dbtest("last owner cannot be disabled or demoted", () => {
  denied(owner, rpcMember("UPDATE", memberId(1), "OWNER", "DISABLED"), "23514");
  denied(owner, rpcMember("UPDATE", memberId(1), "ADMIN"), "23514");
});
dbtest("ownership transfer promotes successor before demoting initiator", () => {
  assert.match(query(owner, `${rpcMember("TRANSFER", memberId(2), null)}; SELECT role FROM lg_organization_memberships WHERE user_id='${owner}'; SELECT role FROM lg_organization_memberships WHERE user_id='${admin}'; SELECT actor_role FROM lg_audit_events WHERE operation='OWNERSHIP_TRANSFERRED'`), /ADMIN\nOWNER\nOWNER$/);
});
dbtest("disabled/removed membership immediately loses SQL and RPC access", () => {
  for (const status of ["DISABLED", "REMOVED"]) {
    const sql = transaction(owner, `${rpcMember("UPDATE", memberId(3), "DEVELOPER", status)}; SET LOCAL request.jwt.claim.sub='${developer}'; SELECT count(*) FROM lg_projects`);
    assert.match(execute(sql), /\n0$/);
    const result = raw(transaction(owner, `${rpcMember("UPDATE", memberId(3), "DEVELOPER", status)}; SET LOCAL request.jwt.claim.sub='${developer}'; SELECT lg_create_project('${org}','denied','${correlation}')`));
    assert.match(result.stderr, /42501/);
  }
});
dbtest("legacy StartupX admin does not authorize LaunchGate", () => denied(outsider, rpcMember("ADD", null, "OWNER")));
dbtest("member can read project and developer can create", () => {
  assert.equal(query(viewer, `SELECT name FROM lg_projects WHERE id='${project}'`), "Alpha project");
  assert.match(query(developer, `SELECT name FROM lg_create_project('${org}','Created','${correlation}')`), /^Created$/);
});
dbtest("viewer cannot create projects", () => denied(viewer, `SELECT lg_create_project('${org}','No','${correlation}')`));
dbtest("outsider cannot read, update, delete or create target project", () => {
  assert.equal(query(outsider, `SELECT count(*) FROM lg_projects WHERE id='${project}'`), "0");
  denied(outsider, `UPDATE lg_projects SET name='No' WHERE id='${project}'`);
  denied(outsider, `DELETE FROM lg_projects WHERE id='${project}'`);
  denied(outsider, `SELECT lg_create_project('${org}','No','${correlation}')`);
});
dbtest("retention composite FK rejects foreign project even through authorized RPC", () => denied(owner, `SELECT lg_set_retention('${org}','${otherProject}','ARTIFACTS',1,'${correlation}')`, "23503"));
dbtest("retention durations constrained and shorter customer retention accepted", () => {
  for (const days of [0, 3651]) denied(owner, `SELECT lg_set_retention('${org}',NULL,'ARTIFACTS',${days},'${correlation}')`, "23514");
  assert.equal(query(owner, `SELECT duration_days FROM lg_set_retention('${org}','${project}','ARTIFACTS',1,'${correlation}')`), "1");
});
dbtest("developer cannot change security retention", () => denied(developer, `SELECT lg_set_retention('${org}',NULL,'ARTIFACTS',1,'${correlation}')`));
dbtest("safe secret metadata is scoped; backend locator and plaintext unavailable", () => {
  assert.equal(query(owner, "SELECT count(id) FROM lg_secret_references"), "1");
  assert.equal(query(outsider, "SELECT count(id) FROM lg_secret_references"), "0");
  assert.equal(query(developer, "SELECT count(id) FROM lg_secret_references"), "0");
  denied(owner, "SELECT backend_reference FROM lg_secret_references");
  assert.equal(execute("SELECT count(*) FROM information_schema.columns WHERE table_name='lg_secret_references' AND column_name IN ('secret','token','plaintext','ciphertext','password')"), "0");
});
dbtest("secret cross-org project FK rejected under privileged DB identity", () => {
  const result = raw(`BEGIN; INSERT INTO lg_secret_references(organization_id,project_id,kind,provider,backend_reference,purpose,created_by) VALUES('${org}','${otherProject}','PROVIDER_CREDENTIAL','MANAGED_SECRET_BACKEND','${uid(800)}','INTEGRATION','${owner}'); ROLLBACK;`);
  assert.match(result.stderr, /23503/);
});
dbtest("browser cannot insert secret references", () => denied(owner, `INSERT INTO lg_secret_references(organization_id,kind,provider,backend_reference,purpose,created_by) VALUES('${org}','PROVIDER_CREDENTIAL','MANAGED_SECRET_BACKEND','${uid(800)}','INTEGRATION','${owner}')`));
dbtest("browser cannot forge, edit, or delete audit", () => {
  denied(owner, `INSERT INTO lg_audit_events(organization_id,actor_user_id,actor_membership_id,actor_role,operation,target_type,target_id,correlation_id,outcome) VALUES('${org}','${owner}','${memberId(1)}','OWNER','PROJECT_CREATED','PROJECT','${project}','${correlation}','SUCCEEDED')`);
  denied(owner, "UPDATE lg_audit_events SET actor_role='OWNER'"); denied(owner, "DELETE FROM lg_audit_events");
});
dbtest("audit read is role scoped and captures verified actor without submitted metadata", () => {
  assert.match(query(owner, `SELECT lg_create_project('${org}','audit','${correlation}'); SELECT actor_user_id||':'||safe_metadata::text FROM lg_audit_events`), new RegExp(`${owner}:\\{\\}$`));
  assert.equal(query(viewer, "SELECT count(*) FROM lg_audit_events"), "0");
});
dbtest("audit insertion failure rolls back business mutation", () => denied(owner, `SELECT lg_create_project('${org}','rollback',NULL)`, "23502"));
dbtest("audit composite FK prevents cross-organization actor membership", () => {
  const result=raw(`BEGIN; INSERT INTO lg_audit_events(organization_id,actor_user_id,actor_membership_id,actor_role,operation,target_type,target_id,correlation_id,outcome) VALUES('${org}','${outsider}','${memberId(5)}','OWNER','PROJECT_CREATED','PROJECT','${project}','${correlation}','SUCCEEDED'); ROLLBACK;`);
  assert.match(result.stderr,/23503/);
});
dbtest("append-only audit trigger rejects even privileged row updates", () => {
  const result=raw(`BEGIN; SET LOCAL request.jwt.claim.sub='${owner}'; SELECT lg_create_project('${org}','audit','${correlation}'); UPDATE lg_audit_events SET actor_role='VIEWER'; ROLLBACK;`);
  assert.match(result.stderr,/42501/);
});
dbtest("outsider sees no populated memberships, retention or audit records", () => {
  const result=query(owner,`SELECT lg_set_retention('${org}',NULL,'ARTIFACTS',1,'${correlation}'); SET LOCAL request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM lg_organization_memberships WHERE organization_id='${org}'; SELECT count(*) FROM lg_retention_policies WHERE organization_id='${org}'; SELECT count(*) FROM lg_audit_events WHERE organization_id='${org}'`);
  assert.match(result,/\n0\n0\n0$/);
});
dbtest("deletion is owner-only", () => {
  for (const user of [admin, developer, viewer, outsider]) denied(user, `SELECT lg_request_deletion('${org}','${correlation}')`);
});
dbtest("deletion disables normal access and durably queues seven tasks", () => {
  assert.match(query(owner, `SELECT state FROM lg_request_deletion('${org}','${correlation}'); SELECT count(*) FROM lg_organizations WHERE id='${org}'; SELECT count(*) FROM lg_projects; SELECT count(*) FROM lg_deletion_tasks; SELECT operation FROM lg_audit_events WHERE operation='DELETION_REQUESTED'`), /^AUTHORIZED\n0\n0\n7\nDELETION_REQUESTED$/);
});
dbtest("pending org denies new commands even for owner", () => denied(owner, `SELECT lg_request_deletion('${org}','${correlation}'); SELECT lg_create_project('${org}','No','${correlation}')`));
dbtest("outsider cannot read populated deletion requests or cleanup tasks", () => {
  const result=query(owner,`SELECT lg_request_deletion('${org}','${correlation}'); SET LOCAL request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM lg_deletion_requests WHERE organization_id='${org}'; SELECT count(*) FROM lg_deletion_tasks WHERE organization_id='${org}'`);
  assert.match(result,/\n0\n0$/);
});
dbtest("pending security read exposes only own permitted membership", () => {
  assert.match(query(owner, `SELECT lg_request_deletion('${org}','${correlation}'); SELECT role FROM lg_read_security_membership('${org}')`), /\nOWNER$/);
  assert.equal(query(outsider, `SELECT count(*) FROM lg_read_security_membership('${org}') WHERE id IS NOT NULL`), "0");
});
dbtest("browser cannot forge deletion states/tasks", () => {
  denied(owner, "UPDATE lg_deletion_requests SET state='COMPLETED',completed_at=now()");
  denied(owner, "UPDATE lg_deletion_tasks SET state='COMPLETED'");
  denied(owner, `INSERT INTO lg_deletion_requests(organization_id,requested_by,state,authorized_at) VALUES('${org}','${owner}','AUTHORIZED',now())`);
});
dbtest("deletion state machine rejects jumping to completion", () => {
  const result = raw(`BEGIN; SET LOCAL request.jwt.claim.sub='${owner}'; SELECT lg_request_deletion('${org}','${correlation}'); UPDATE lg_deletion_requests SET state='COMPLETED' WHERE organization_id='${org}'; ROLLBACK;`);
  assert.match(result.stderr, /23514/);
});
dbtest("deletion task cross-tenant request FK rejected", () => {
  const result = raw(`BEGIN; SET LOCAL request.jwt.claim.sub='${owner}'; SELECT lg_request_deletion('${org}','${correlation}'); INSERT INTO lg_deletion_tasks(organization_id,deletion_request_id,category) SELECT '${other}',id,'ARTIFACTS' FROM lg_deletion_requests WHERE organization_id='${org}'; ROLLBACK;`);
  // unique category may fail first; use a new request and move its org instead below.
  assert.notEqual(result.status, 0);
  const fk = raw(`BEGIN; INSERT INTO lg_deletion_requests(id,organization_id,requested_by,state) VALUES('${uid(999)}','${org}','${owner}','REQUESTED'); INSERT INTO lg_deletion_tasks(organization_id,deletion_request_id,category) VALUES('${other}','${uid(999)}','ARTIFACTS'); ROLLBACK;`);
  assert.match(fk.stderr, /23503/);
});
dbtest("future privileged worker must finish all cleanup before completion", () => {
  const base = `BEGIN; SET LOCAL request.jwt.claim.sub='${owner}'; SELECT lg_request_deletion('${org}','${correlation}'); UPDATE lg_deletion_requests SET state='RUNNING' WHERE organization_id='${org}';`;
  assert.match(raw(`${base} UPDATE lg_deletion_requests SET state='COMPLETED'; ROLLBACK;`).stderr, /23514/);
  assert.match(execute(`${base} UPDATE lg_deletion_tasks SET state='RUNNING'; UPDATE lg_deletion_tasks SET state='COMPLETED'; UPDATE lg_deletion_requests SET state='COMPLETED'; SELECT status FROM lg_organizations WHERE id='${org}'; ROLLBACK;`), /\nDELETED$/);
});
dbtest("service role has no blanket table or command grants", () => {
  denied(owner, "SELECT * FROM lg_organizations", "42501", "service_role");
  denied(owner, `SELECT lg_create_organization('No','${correlation}')`, "42501", "service_role");
});
dbtest("service-role BYPASSRLS is tested separately and never mistaken for user RLS", () => {
  assert.equal(execute(`BEGIN; GRANT SELECT ON lg_organizations TO service_role; SET LOCAL ROLE service_role; SELECT count(*) FROM lg_organizations; ROLLBACK;`), "2");
});
dbtest("RLS denies DML even if someone accidentally grants table write privileges", () => {
  assert.equal(execute(`BEGIN; GRANT UPDATE ON lg_projects TO authenticated; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${outsider}'; UPDATE lg_projects SET name='hijack' WHERE id='${project}'; RESET ROLE; SELECT name FROM lg_projects WHERE id='${project}'; ROLLBACK;`), "Alpha project");
  const result = raw(`BEGIN; GRANT INSERT ON lg_organizations TO authenticated; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${outsider}'; INSERT INTO lg_organizations(name,created_by) VALUES('No','${outsider}'); ROLLBACK;`);
  assert.match(result.stderr, /42501/);
});
dbtest("private authorization/audit helpers cannot be called by browser", () => denied(owner, `SELECT launchgate_private.require_actor('${org}',ARRAY['OWNER'])`));
dbtest("PostgREST honors user JWT and RLS on unfiltered lists", () => {
  const response=http(outsider,"lg_organizations?select=id"); assert.equal(response.status,0,response.stderr);
  assert.deepEqual(JSON.parse(response.stdout),[{id:other}]);
});
dbtest("PostgREST singleton RPC representation matches API command adapter", () => {
  const response=http(candidate,"rpc/lg_create_organization",{p_name:"HTTP fixture",p_correlation:correlation},true);
  assert.equal(response.status,0,response.stderr); const data=JSON.parse(response.stdout);
  assert.equal(data.name,"HTTP fixture"); assert.equal(data.created_by,candidate); assert.ok(!Array.isArray(data));
});
dbtest("PostgREST security membership RPC supports a singular representation", () => {
  const response=http(owner,"rpc/lg_read_security_membership",{p_organization:org},true);
  assert.equal(response.status,0,response.stderr); assert.equal(JSON.parse(response.stdout).role,"OWNER");
});
dbtest("PostgREST direct browser membership insertion is forbidden", () => {
  const response=http(developer,"lg_organization_memberships",{organization_id:org,user_id:candidate,role:"OWNER"});
  assert.notEqual(response.status,0); assert.match(response.stderr,/403/);
});
dbtest("PostgREST exposes safe metadata but denies backend reference selection", () => {
  const safe=http(owner,"lg_secret_references?select=id,kind,provider,purpose"); assert.equal(safe.status,0,safe.stderr);
  assert.equal(JSON.parse(safe.stdout).length,1); assert.doesNotMatch(safe.stdout,/backend_reference|token|plaintext/);
  const unsafe=http(owner,"lg_secret_references?select=*"); assert.notEqual(unsafe.status,0); assert.match(unsafe.stderr,/403/);
});
dbtest("concurrent owner demotions cannot remove every owner", async () => {
  execute(`SET request.jwt.claim.sub='${owner}'; ${rpcMember("UPDATE", memberId(2), "OWNER")}`);
  const run = (user: string, target: string) => new Promise<{ code: number | null; stderr: string }>(resolve => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "postgres", "-d", "launchgate_test"], { windowsHide: true });
    let stderr = ""; child.stderr.on("data", data => { stderr += data; }); child.stdout.resume();
    child.on("close", code => resolve({ code, stderr }));
    child.stdin.end(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${user}'; ${rpcMember("UPDATE", target, "ADMIN")}; SELECT pg_sleep(0.2); COMMIT;`);
  });
  const results = await Promise.all([run(owner, memberId(1)), run(admin, memberId(2))]);
  assert.equal(results.filter(r => r.code === 0).length, 1);
  assert.match(results.find(r => r.code !== 0)!.stderr, /23514/);
  assert.equal(execute(`SELECT count(*) FROM lg_organization_memberships WHERE organization_id='${org}' AND role='OWNER' AND status='ACTIVE'`), "1");
});

// Phase 3 runs AFTER the unchanged Phase 2 rehearsal and assertions above.
const sourceOrg=uid(2000), foreignOrg=uid(2001), sourceProject=uid(2100), foreignProject=uid(2101);
let connectionId="", snapshotId="", proposalId="";
const literal=(value:unknown)=>`'${JSON.stringify(value).replace(/'/g,"''")}'::jsonb`;
const serviceSql=(action:string,data:unknown)=>`SELECT public.lg_source_service('${action}',${literal(data)})`;
const service=(action:string,data:unknown)=>JSON.parse(execute(`SET ROLE service_role; ${serviceSql(action,data)}`)||"null");
function setupState(projectId=sourceProject,userId=owner,installation=456,repository=789) {
 const stateHash=createHash("sha256").update(randomUUID()).digest("hex");
 execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${userId}'; SELECT lg_github_setup('${projectId}','${stateHash}',${installation},${repository},'','${correlation}')`);
 return {stateHash,actorId:userId,appId:123,installationId:installation,repositoryId:repository,accountId:12,owner:"fixture",name:"sample",visibility:"PRIVATE",defaultBranch:"main",correlationId:correlation};
}
dbtest("Phase 3 forward migrations apply over the complete rehearsed chain",()=>{
 execute(readFileSync("migrations/016_launchgate_source_model.sql","utf8"));execute(readFileSync("migrations/017_launchgate_source_commands.sql","utf8"));
 execute(`INSERT INTO lg_organizations(id,name,created_by) VALUES('${sourceOrg}','Source Alpha','${owner}'),('${foreignOrg}','Source Beta','${outsider}');
 INSERT INTO lg_organization_memberships(organization_id,user_id,role) VALUES('${sourceOrg}','${owner}','OWNER'),('${sourceOrg}','${developer}','DEVELOPER'),('${sourceOrg}','${viewer}','VIEWER'),('${foreignOrg}','${outsider}','OWNER');
 INSERT INTO lg_projects(id,organization_id,name,created_by) VALUES('${sourceProject}','${sourceOrg}','Source app','${owner}'),('${foreignProject}','${foreignOrg}','Foreign app','${outsider}');`);
 connectionId=service("BIND",setupState()).connectionId;
 snapshotId=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"a".repeat(40)}','${correlation}')`);
 assert.ok(connectionId);assert.ok(snapshotId);
});
dbtest("all Phase 3 public tables and private nonce table force RLS",()=>{
 assert.equal(execute("SELECT count(*) FROM pg_class WHERE relkind='r' AND relrowsecurity AND relforcerowsecurity AND (relname LIKE 'lg_%' OR relname='github_setup_states')"),"18");
});
dbtest("browser cannot call provider verification gateway or forge inbox",()=>{
 denied(owner,serviceSql("BIND",{}));denied(owner,"INSERT INTO lg_integration_event_inbox(provider) VALUES('GITHUB')");
 denied(owner,"SELECT * FROM launchgate_private.github_setup_states");
});
dbtest("viewer and developer cannot start integration setup",()=>{
 for(const user of [viewer,developer])denied(user,`SELECT lg_github_setup('${sourceProject}','${"d".repeat(64)}',456,789,'','${correlation}')`);
});
dbtest("guessed or consumed setup state cannot bind an installation",()=>{
 const bad=raw(`SET ROLE service_role; ${serviceSql("BIND",{...setupState(),stateHash:"f".repeat(64)})}`);assert.match(bad.stderr,/42501/);
 const state=setupState();service("BIND",state);assert.match(raw(`SET ROLE service_role; ${serviceSql("BIND",state)}`).stderr,/42501/);
});
dbtest("setup nonce cannot be consumed by another principal",()=>{
 const state=setupState();assert.match(raw(`SET ROLE service_role; ${serviceSql("READ_SETUP",{...state,actorId:outsider})}`).stderr,/42501/);
});
dbtest("installation binding cannot cross organizations even through service function",()=>{
 const foreign=setupState(foreignProject,outsider);assert.match(raw(`SET ROLE service_role; ${serviceSql("BIND",foreign)}`).stderr,/42501/);
});
dbtest("selected repository ID must match setup authorization",()=>{
 const state=setupState();assert.match(raw(`SET ROLE service_role; ${serviceSql("BIND",{...state,repositoryId:999})}`).stderr,/42501/);
});
dbtest("repository rename updates metadata without duplicating identity or connection",()=>{
 const renamed=service("BIND",{...setupState(),name:"renamed"});assert.equal(renamed.connectionId,connectionId);
 assert.equal(query(owner,`SELECT count(*) FROM lg_installation_repositories WHERE organization_id='${sourceOrg}'`),"1");
 assert.equal(query(owner,`SELECT name FROM lg_installation_repositories WHERE organization_id='${sourceOrg}'`),"renamed");
});
dbtest("cross-org repository connections and snapshots are invisible",()=>{
 assert.equal(query(outsider,`SELECT count(*) FROM lg_repository_connections WHERE id='${connectionId}'`),"0");
 assert.equal(query(outsider,`SELECT count(id) FROM lg_repository_snapshots WHERE id='${snapshotId}'`),"0");
 denied(outsider,`SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"b".repeat(40)}','${correlation}')`);
});
dbtest("cross-tenant project/connection FK fails under privileged identity",()=>{
 const result=raw(`BEGIN; INSERT INTO lg_repository_snapshots(organization_id,project_id,connection_id,commit_sha,requested_by) VALUES('${foreignOrg}','${foreignProject}','${connectionId}','${"b".repeat(40)}','${outsider}'); ROLLBACK;`);assert.match(result.stderr,/23503/);
});
dbtest("snapshot request is idempotent and rejects moving refs",()=>{
 assert.equal(query(owner,`SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"a".repeat(40)}','${correlation}')`),snapshotId);
 denied(owner,`SELECT lg_request_snapshot('${sourceProject}','${connectionId}','main','${correlation}')`,"23514");
});
dbtest("browser cannot forge source, architecture or invariant provenance",()=>{
 for(const table of ["lg_source_files","lg_architecture_snapshots","lg_invariant_proposals"])denied(owner,`INSERT INTO ${table}(organization_id) VALUES('${sourceOrg}')`);
 denied(owner,`UPDATE lg_repository_snapshots SET tree_sha='${"f".repeat(40)}'`);
 denied(owner,"SELECT lease FROM lg_repository_snapshots");
});
dbtest("analysis claims fence concurrent workers and stale completion",()=>{
 const claim=service("CLAIM",{snapshotId});assert.equal(claim.snapshot.id,snapshotId);
 assert.equal(service("CLAIM",{snapshotId}),null);
 assert.match(raw(`SET ROLE service_role; ${serviceSql("COMPLETE",{snapshotId,lease:uid(9999)})}`).stderr,/42501/);
 const report={kind:"STATIC_OBSERVATIONS",analysisVersion:"lg-static-1",proposals:[{id:"d".repeat(32),domain:"tenant_isolation",statement:"Members must not read another tenant's data.",status:"PROPOSED",confirmationRequired:true,evidence:[{path:"x.ts",digest:"c".repeat(64),blobSha:"e".repeat(40),startLine:1,endLine:1}],assumptions:["Policy confirmation required"],confidence:"LOW"}]};
 service("COMPLETE",{snapshotId,lease:claim.snapshot.lease,commitSha:"a".repeat(40),treeSha:"b".repeat(40),sourceState:"COMPLETE",files:[{path:"x.ts",digest:"c".repeat(64),blobSha:"e".repeat(40),bytes:10,classification:"SOURCE"}],report,reportDigest:createHash("sha256").update(JSON.stringify(report)).digest("hex")});
 proposalId=query(owner,`SELECT id FROM lg_invariant_proposals WHERE snapshot_id='${snapshotId}'`);
 assert.ok(proposalId);assert.equal(service("CLAIM",{snapshotId}),null);
});
dbtest("architecture/proposals/source metadata remain tenant isolated",()=>{
 for(const table of ["lg_architecture_snapshots","lg_invariant_proposals","lg_source_files"]){assert.equal(query(outsider,`SELECT count(*) FROM ${table} WHERE snapshot_id='${snapshotId}'`),"0");assert.equal(query(owner,`SELECT count(*) FROM ${table} WHERE snapshot_id='${snapshotId}'`),"1");}
});
dbtest("proposal confirmation requires project authorization and ADMIN role",()=>{
 for(const user of [outsider,developer,viewer])denied(user,`SELECT lg_review_invariant('${sourceProject}','${proposalId}','CONFIRM','Policy','${randomUUID()}','${correlation}')`);
});
dbtest("confirmation retries deduplicate and refinement creates immutable versions",()=>{
 const key=randomUUID();const command=`SELECT version FROM lg_review_invariant('${sourceProject}','${proposalId}','CONFIRM','Policy','${key}','${correlation}')`;
 assert.equal(execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; ${command}`),"1");assert.equal(query(owner,command),"1");
 assert.equal(execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT version FROM lg_review_invariant('${sourceProject}','${proposalId}','REFINE','Refined policy','${randomUUID()}','${correlation}')`),"2");
 denied(owner,`UPDATE lg_invariant_confirmations SET statement='rewrite' WHERE proposal_id='${proposalId}'`);
 denied(owner,`SELECT lg_review_invariant('${sourceProject}','${proposalId}','CONFIRM','Changed','${key}','${correlation}')`,"22023");
 assert.equal(query(outsider,`SELECT count(*) FROM lg_invariant_confirmations WHERE proposal_id='${proposalId}'`),"0");
});
dbtest("webhook deduplication is durable, scoped and idempotent",()=>{
 const data={appId:123,deliveryId:randomUUID(),installationId:456,event:"installation",action:"IGNORE",digest:"f".repeat(64)};
 assert.equal(service("WEBHOOK",data).duplicate,false);assert.equal(service("WEBHOOK",data).duplicate,true);
 assert.equal(service("WEBHOOK",{...data,appId:124}).duplicate,false);
 assert.equal(query(owner,`SELECT count(*) FROM lg_integration_event_inbox WHERE delivery_id='${data.deliveryId}'`),"1");
 assert.equal(query(outsider,"SELECT count(*) FROM lg_integration_event_inbox"),"0");
});
dbtest("webhook revocation blocks subsequent snapshot access until verified rebind",()=>{
 service("WEBHOOK",{appId:123,deliveryId:randomUUID(),installationId:456,event:"installation",action:"REVOKE",digest:"a".repeat(64)});
 denied(owner,`SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"c".repeat(40)}','${correlation}')`);
 assert.match(raw(`SET ROLE service_role; ${serviceSql("CLAIM",{snapshotId})}`).stderr,/42501/);
 service("BIND",setupState());
});
dbtest("explicit disconnect blocks subsequent snapshot requests",()=>{
 const pending=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"d".repeat(40)}','${correlation}')`);
 const lease=service("CLAIM",{snapshotId:pending}).snapshot.lease;
 service("CHECK",{snapshotId:pending,lease});
 execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_disconnect_repository('${sourceProject}','${connectionId}','${correlation}')`);
 denied(owner,`SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"c".repeat(40)}','${correlation}')`);
 denied(owner,`SELECT lg_retry_snapshot('${sourceProject}','${pending}','${correlation}')`);
 assert.match(raw(`SET ROLE service_role; ${serviceSql("CHECK",{snapshotId:pending,lease})}`).stderr,/42501/);
 assert.equal(query(owner,`SELECT state||':'||failure_code FROM lg_repository_snapshots WHERE id='${pending}'`),"FAILED:ACCESS_REVOKED");
});
dbtest("security-sensitive source operations create durable audit without token columns",()=>{
 assert.equal(query(owner,`SELECT count(DISTINCT operation) FROM lg_audit_events WHERE organization_id='${sourceOrg}'`),"5");
 assert.equal(execute("SELECT count(*) FROM information_schema.columns WHERE table_name IN ('lg_github_installations','lg_installation_repositories','lg_repository_connections','lg_repository_snapshots','lg_integration_event_inbox') AND column_name IN ('token','access_token','private_key','raw_body')"),"0");
});

// Phase 4 runs after the unchanged Phase 2/3 assertions above.
const executionSql=(action:string,data:unknown)=>`SELECT public.lg_execution_service('${action}',${literal(data)})`;
const executionService=(action:string,data:unknown={})=>JSON.parse(execute(`SET ROLE service_role; ${executionSql(action,data)}`)||"null");
const commandSql=(action:string,data:unknown,p=sourceProject)=>`SELECT public.lg_execution_command('${p}','${action}',${literal(data)},'${correlation}')`;
const executionCommand=(action:string,data:unknown,user=owner)=>JSON.parse(execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; ${commandSql(action,data)}`));
let environmentId:string,deploymentId:string,vercelId:string;
function authorizeTarget(extra:Record<string,unknown>={}) {return executionCommand("AUTHORIZE",{deploymentId,requestKey:randomUUID(),expiresAt:new Date(Date.now()+1800000).toISOString(),requestLimit:10,concurrencyLimit:1,durationSeconds:60,...extra}).id;}
function createRun(authorizationId=authorizeTarget(),extra:Record<string,unknown>={}) {return executionCommand("RUN",{authorizationId,snapshotId,requestKey:randomUUID(),invariants:[],...extra}).id;}
function claimRun(){return executionService("CLAIM",{workerId:uid(8000)});}
function attemptAuthority(c:ReturnType<typeof claimRun>){return {attemptId:c.attempt.id,fence:c.job.fence,grantId:c.attempt.grant_id,runnerId:c.attempt.runner_id};}
function cleanupAttempt(){const c=executionService("CLEANUP_CLAIM",{workerId:uid(8000)});assert.ok(c);executionService("CLEANUP_DONE",{attemptId:c.attempt.id,fence:c.attempt.fence,workerId:uid(8000)});return c;}
function stopAll(){execute(`UPDATE lg_verification_runs SET state='CANCELLING' WHERE state IN ('QUEUED','PREPARING','RUNNING');`);executionService("RECOVER");while(execute("SELECT count(*) FROM lg_jobs WHERE state='CLEANUP'")!=="0")cleanupAttempt();}

dbtest("Phase 4 migrations apply forward after all Phase 3 tests",()=>{
 execute(readFileSync("migrations/018_launchgate_execution_model.sql","utf8"));execute(readFileSync("migrations/019_launchgate_execution_commands.sql","utf8"));
 service("BIND",setupState());
 environmentId=executionCommand("ENVIRONMENT",{name:"Preview",type:"PREVIEW"}).id;
 vercelId=executionService("CONNECT",{projectId:sourceProject,actorId:owner,accountId:"team_fixture",providerProjectId:"prj_fixture",credentialReference:uid(8001)}).id;
 deploymentId=executionService("DEPLOYMENT",{projectId:sourceProject,actorId:owner,environmentId,connectionId:vercelId,repositoryConnectionId:connectionId,providerDeploymentId:"dpl_fixture",targetUrl:"https://fixture-hash.vercel.app/",commitSha:"a".repeat(40),proofDigest:"f".repeat(64)}).id;
 assert.equal(execute("SELECT count(*) FROM pg_class WHERE relname IN ('lg_environments','lg_deployments','lg_target_authorizations','lg_runner_leases') AND relrowsecurity AND relforcerowsecurity"),"4");
});
for(const table of ["lg_environments","lg_deployments","lg_verification_runs","lg_artifacts","lg_evidence_manifests"])dbtest(`Phase 4 cross-tenant ${table} read denied`,()=>{
 assert.equal(query(outsider,`SELECT count(*) FROM ${table} WHERE organization_id='${sourceOrg}'`),"0");
});
for(const table of ["lg_authorization_proofs","lg_deployments","lg_runner_leases","lg_artifacts","lg_evidence_manifests","lg_assertion_results","lg_jobs"])
 dbtest(`browser cannot forge ${table}`,()=>denied(owner,`INSERT INTO ${table}(organization_id) VALUES('${sourceOrg}')`));
dbtest("browser cannot claim/complete attempts or mint grants",()=>{for(const action of ["CLAIM","START","COMPLETE","CONNECT"])denied(owner,executionSql(action,{}));denied(owner,"SELECT * FROM lg_runner_leases");});
dbtest("viewer cannot execute and developer cannot authorize",()=>{
 denied(viewer,commandSql("RUN",{}));denied(developer,commandSql("AUTHORIZE",{deploymentId}));
});
dbtest("explicit authorization idempotency and exact deployment binding",()=>{
 const request={deploymentId,requestKey:randomUUID(),expiresAt:new Date(Date.now()+1800000).toISOString(),requestLimit:10,concurrencyLimit:1,durationSeconds:60};
 const a=executionCommand("AUTHORIZE",request);assert.deepEqual(executionCommand("AUTHORIZE",request),a);
 denied(owner,commandSql("AUTHORIZE",{...request,requestLimit:11}),"22023");
 assert.equal(query(owner,`SELECT hostname||':'||ports[1]||':'||operations[1] FROM lg_target_allowlists WHERE authorization_id='${a.id}'`),"fixture-hash.vercel.app:443:resource.read");
});
dbtest("run request deduplicates and binds snapshot/deployment/authorization",()=>{
 const authorizationId=authorizeTarget();const request={authorizationId,snapshotId,requestKey:randomUUID(),invariants:[]};
 const run=executionCommand("RUN",request,developer);assert.deepEqual(executionCommand("RUN",request,developer),run);
 assert.equal(query(owner,`SELECT count(*) FROM lg_jobs WHERE run_id='${run.id}'`),"1");
 denied(owner,commandSql("RUN",{...request,invariants:[{}]}),"22023");stopAll();
});
dbtest("commit mismatch and unconfirmed invariant are rejected",()=>{
 const otherSnapshot=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_request_snapshot('${sourceProject}','${connectionId}','${"b".repeat(40)}','${correlation}')`);
 denied(owner,commandSql("RUN",{authorizationId:authorizeTarget(),snapshotId:otherSnapshot,requestKey:randomUUID(),invariants:[]}),"23503");
 denied(owner,commandSql("RUN",{authorizationId:authorizeTarget(),snapshotId,requestKey:randomUUID(),invariants:[{id:uid(9988),version:1}]}));
});
dbtest("worker crash requires cleanup before stale lease recovery and fences A",()=>{
 const run=createRun();const a=claimRun();assert.equal(a.run.id,run);executionService("START",attemptAuthority(a));assert.equal(claimRun(),null);
 execute(`UPDATE lg_runner_leases SET expires_at=now()-interval '1 second' WHERE attempt_id='${a.attempt.id}'`);executionService("RECOVER");
 assert.equal(claimRun(),null);cleanupAttempt();execute(`UPDATE lg_jobs SET available_at=now() WHERE run_id='${run}'`);
 const b=claimRun();assert.ok(b.job.fence>a.job.fence);assert.notEqual(b.attempt.id,a.attempt.id);
 assert.match(raw(`SET ROLE service_role; ${executionSql("COMPLETE",attemptAuthority(a))}`).stderr,/42501/);stopAll();
});
dbtest("grant is one-time and foreign runner cannot start",()=>{
 createRun();const c=claimRun();assert.match(raw(`SET ROLE service_role; ${executionSql("START",{...attemptAuthority(c),runnerId:uid(8899)})}`).stderr,/42501/);
 executionService("START",attemptAuthority(c));assert.match(raw(`SET ROLE service_role; ${executionSql("START",attemptAuthority(c))}`).stderr,/42501/);stopAll();
});
dbtest("authorization revoked while queued prevents claim",()=>{
 const a=authorizeTarget();createRun(a);executionCommand("REVOKE",{authorizationId:a});assert.equal(claimRun(),null);executionService("RECOVER");
});
dbtest("authorization revoked while running rejects request/evidence and releases after cleanup",()=>{
 const a=authorizeTarget();createRun(a);const c=claimRun();executionService("START",attemptAuthority(c));executionCommand("REVOKE",{authorizationId:a});
 for(const action of ["REQUEST","COMPLETE"])assert.match(raw(`SET ROLE service_role; ${executionSql(action,attemptAuthority(c))}`).stderr,/42501/);
 executionService("RECOVER");cleanupAttempt();assert.equal(execute(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${sourceOrg}'`),"0:0");
});
dbtest("cancel races cannot finalize success and cleanup persists across restart",()=>{
 const run=createRun();const c=claimRun();executionService("START",attemptAuthority(c));executionCommand("CANCEL",{runId:run},developer);
 assert.match(raw(`SET ROLE service_role; ${executionSql("COMPLETE",attemptAuthority(c))}`).stderr,/42501/);
 executionService("RECOVER");const cleanup=executionService("CLEANUP_CLAIM",{workerId:uid(8000)});assert.ok(cleanup);
 execute(`UPDATE lg_runner_leases SET cleanup_expires_at=now()-interval '1 second' WHERE attempt_id='${c.attempt.id}'`);cleanupAttempt();
 assert.equal(query(owner,`SELECT state FROM lg_verification_runs WHERE id='${run}'`),"CANCELLED");
});
dbtest("request reservations enforce org concurrency and per-authorization ceilings",()=>{
 const auth=authorizeTarget({concurrencyLimit:2,requestLimit:2});createRun(auth);createRun(auth);const c=claimRun();assert.equal(claimRun(),null);
 executionService("START",attemptAuthority(c));executionService("REQUEST",attemptAuthority(c));
 execute(`UPDATE lg_job_attempts SET next_request_at=now()-interval '1 second' WHERE id='${c.attempt.id}'`);executionService("REQUEST",attemptAuthority(c));
 assert.match(raw(`SET ROLE service_role; ${executionSql("REQUEST",attemptAuthority(c))}`).stderr,/42501/);stopAll();
});
dbtest("expired lease cannot heartbeat or admit evidence",()=>{
 createRun();const c=claimRun();executionService("START",attemptAuthority(c));execute(`UPDATE lg_runner_leases SET expires_at=now()-interval '1 second' WHERE attempt_id='${c.attempt.id}'`);
 for(const action of ["CHECK","COMPLETE"])assert.match(raw(`SET ROLE service_role; ${executionSql(action,attemptAuthority(c))}`).stderr,/42501/);stopAll();
});
dbtest("sealed evidence, duplicate completion, immutable artifacts and cross-tenant metadata",()=>{
 const run=createRun();const c=claimRun();executionService("START",attemptAuthority(c));executionService("REQUEST",attemptAuthority(c));
 const data={...attemptAuthority(c),requests:1,digest:`sha256:${"e".repeat(64)}`,manifest:{runId:run,attemptId:c.attempt.id,commitSha:c.run.commit_sha,deploymentId,authorizationId:c.run.authorization_id,authorizationVersion:c.run.authorization_version,fence:c.job.fence,runnerId:c.attempt.runner_id},artifacts:[],observations:[]};
 executionService("COMPLETE",data);assert.equal(executionService("COMPLETE",data).duplicate,true);
 denied(owner,"UPDATE lg_evidence_manifests SET digest='forged'");assert.equal(query(outsider,`SELECT count(*) FROM lg_evidence_manifests WHERE run_id='${run}'`),"0");
 cleanupAttempt();assert.equal(query(owner,`SELECT state||':'||result FROM lg_verification_runs WHERE id='${run}'`),"COMPLETED:UNOBSERVABLE");
});
dbtest("revoked member immediately loses run reads and execution",()=>{
 const run=createRun();execute(`UPDATE lg_organization_memberships SET status='DISABLED' WHERE organization_id='${sourceOrg}' AND user_id='${developer}'`);
 assert.equal(query(developer,`SELECT count(*) FROM lg_verification_runs WHERE id='${run}'`),"0");denied(developer,commandSql("CANCEL",{runId:run}));
 execute(`UPDATE lg_organization_memberships SET status='ACTIVE' WHERE organization_id='${sourceOrg}' AND user_id='${developer}'`);stopAll();
});
dbtest("revoked Vercel connection cannot authorize a run",()=>{
 const a=authorizeTarget();executionCommand("REVOKE_CONNECTION",{connectionId:vercelId});
 denied(owner,commandSql("RUN",{authorizationId:a,snapshotId,requestKey:randomUUID(),invariants:[]}));
});

dbtest("parallel claim transactions atomically reserve organization capacity",async()=>{
 execute(`UPDATE lg_vercel_connections SET status='ACTIVE' WHERE id='${vercelId}'`);
 createRun(authorizeTarget({concurrencyLimit:2}));createRun(authorizeTarget({concurrencyLimit:2}));
 const race=()=>new Promise<string>((resolve,reject)=>{
  const child=spawn("docker",["exec","-i",container,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","launchgate_test"],{windowsHide:true});let out="",err="";
  child.stdout.on("data",d=>{out+=d;});child.stderr.on("data",d=>{err+=d;});child.on("close",code=>code===0?resolve(out.trim()):reject(new Error(err)));
  child.stdin.end(`BEGIN; SET LOCAL ROLE service_role; ${executionSql("CLAIM",{workerId:randomUUID()})}; SELECT pg_sleep(0.2); COMMIT;`);
 });
 const results=await Promise.all([race(),race()]);assert.equal(results.filter(x=>x.includes('"attempt"')).length,1);
 assert.equal(execute(`SELECT active FROM lg_execution_budgets WHERE organization_id='${sourceOrg}'`),"2");stopAll();
});
dbtest("three failed attempts dead-letter only after cleanup and release budgets",()=>{
 const run=createRun();
 for(let i=0;i<3;i++){const c=claimRun();assert.ok(c);executionService("START",attemptAuthority(c));executionService("FAIL",attemptAuthority(c));cleanupAttempt();execute(`UPDATE lg_jobs SET available_at=now() WHERE run_id='${run}'`);}
 assert.equal(query(owner,`SELECT state FROM lg_verification_runs WHERE id='${run}'`),"FAILED_INFRASTRUCTURE");assert.equal(execute(`SELECT state FROM lg_jobs WHERE run_id='${run}'`),"DEAD");
 assert.equal(execute(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${sourceOrg}'`),"0:0");
});
dbtest("authorization/proof expiry and changed provider status deny execution",()=>{
 const auth=authorizeTarget();createRun(auth);execute(`UPDATE lg_authorization_proofs SET revoked_at=now() WHERE deployment_id='${deploymentId}'`);assert.equal(claimRun(),null);executionService("RECOVER");
 denied(owner,commandSql("AUTHORIZE",{deploymentId,requestKey:randomUUID(),expiresAt:new Date(Date.now()+100000).toISOString(),requestLimit:10,concurrencyLimit:1,durationSeconds:30}));
});

// Phase 5 extends the real database rehearsal without weakening earlier checks.
let labOrg:string,labProject:string,labRun:string,labFinding:string,labRegression:string,labLastReplay:string,labLastRequest:string;
dbtest("Phase 5 migrations apply after Phase 4 and preserve all previous data",()=>{
 execute(readFileSync("migrations/020_launchgate_dynamic_model.sql","utf8"));execute(readFileSync("migrations/021_launchgate_dynamic_commands.sql","utf8"));
 assert.equal(execute("SELECT count(*) FROM pg_class WHERE relname IN ('lg_findings','lg_reproduction_bundles','lg_test_attempts','lg_regression_tests') AND relrowsecurity AND relforcerowsecurity"),"4");
});
dbtest("Phase 5 end-to-end: provision, authorize, schedule, reproduce, fix, regress; no manual DB edits",async()=>{
 const {generateKeyPairSync}=await import("node:crypto");const {mkdtemp,rm}=await import("node:fs/promises");const {tmpdir}=await import("node:os");const {join}=await import("node:path");
 const {compilePlan,defaultCapabilities,labInvariant}=await import("../../reference-lab/plans");
 const {registerLabRun,LocalLabProvider}=await import("../../reference-lab/host");
 const {Orchestrator}=await import("../../services/orchestrator/orchestrator");const {LocalArtifacts}=await import("../../services/orchestrator/artifacts");
 labOrg=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_organization('Phase 5 synthetic organization','${correlation}')`);
 labProject=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_project('${labOrg}','Reference Lab only','${correlation}')`);
 const plan=compilePlan(labInvariant("tenant.write",randomUUID()),"tenant.write","journey-seed",defaultCapabilities("tenant.write"));
 const store={async command(action:string,data:Record<string,unknown>){return executionService(action,data);}};
 const root=await mkdtemp(join(tmpdir(),"launchgate-phase5-"));const artifacts=new LocalArtifacts(root);const keys=generateKeyPairSync("ed25519");
 const provider=new LocalLabProvider(keys.publicKey,store,artifacts);const orchestrator=new Orchestrator(store,provider,keys.privateKey,artifacts);
 const process=async(run:string)=>{await orchestrator.tick();await provider.drain();await orchestrator.tick();const result=provider.results.get(run);assert.ok(result,`missing run ${run}`);assert.equal(execute(`SELECT state FROM lg_verification_runs WHERE id='${run}'`),"COMPLETED");return result;};
 try{
  const created=await registerLabRun(store,labProject,owner,plan,"vulnerable") as {id:string};labRun=created.id;
  const original=await process(labRun);assert.equal(original.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(original.traces.length,2);assert.notDeepEqual(original.traces[0].mapping,original.traces[1].mapping);
  labFinding=execute(`SELECT finding_id FROM lg_finding_occurrences WHERE run_id='${labRun}'`);assert.ok(labFinding);
  assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"REPRODUCED");
  const replay=(variant:string)=>{labLastRequest=randomUUID();labLastReplay=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${labProject}','${labFinding}','${variant}','${labLastRequest}','${correlation}')`);return labLastReplay;};
  const fixed=await process(replay("fixed"));assert.equal(fixed.evaluation.outcome,"PASS");assert.equal(fixed.bundle.planHash,original.bundle.planHash);assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"RESOLVED");
  labRegression=execute(`SELECT id FROM lg_regression_tests WHERE finding_id='${labFinding}'`);assert.ok(labRegression);
  assert.equal(query(owner,`SELECT artifact->>'expectedOutcome' FROM lg_regression_tests WHERE id='${labRegression}'`),"PASS");
  const reintroduced=await process(replay("vulnerable"));assert.equal(reintroduced.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"REGRESSION_FAILED");
  const fixedAgain=await process(replay("fixed"));assert.equal(fixedAgain.evaluation.outcome,"PASS");assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"RESOLVED");
  assert.equal(execute(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${labOrg}'`),"0:0");
  const consumed=Number(execute(`SELECT consumed FROM lg_execution_budgets WHERE organization_id='${labOrg}'`));assert.equal(consumed,[original,fixed,reintroduced,fixedAgain].reduce((n,r)=>n+r.requests,0));
  assert.equal(execute(`SELECT count(*) FROM lg_reproduction_bundles WHERE project_id='${labProject}'`),"4");
 }finally{await provider.drain().catch(()=>{});await rm(root,{recursive:true,force:true});}
});
for(const table of ["lg_findings","lg_finding_occurrences","lg_finding_events","lg_reproduction_bundles","lg_regression_tests","lg_test_attempts","lg_fixture_sets","lg_test_identities","lg_synthetic_resources"])
 dbtest(`Phase 5 populated cross-org ${table} invisible`,()=>{assert.equal(query(outsider,`SELECT count(*) FROM ${table} WHERE project_id='${labProject}'`),"0");assert.ok(Number(query(owner,`SELECT count(*) FROM ${table} WHERE project_id='${labProject}'`))>0);});
for(const table of ["lg_findings","lg_test_attempts","lg_assertion_results","lg_replay_attempts","lg_regression_tests","lg_reproduction_bundles"])
 dbtest(`browser cannot forge dynamic ${table}`,()=>denied(owner,`INSERT INTO ${table}(organization_id) VALUES('${labOrg}')`));
dbtest("browser cannot mark findings reproduced/resolved or forge regression result",()=>{
 denied(owner,`UPDATE lg_findings SET state='REPRODUCED' WHERE id='${labFinding}'`);denied(owner,`UPDATE lg_findings SET state='RESOLVED' WHERE id='${labFinding}'`);denied(owner,`UPDATE lg_assertion_results SET result='PASS' WHERE project_id='${labProject}'`);
 denied(owner,executionSql("LAB_COMPLETE",{}));denied(owner,executionSql("LAB_CREATE",{}));
});
dbtest("cross-project finding reference is rejected even with privileged database identity",()=>{
 // Use an existing foreign run/attempt so only the finding's tenant parent is
 // invalid. Reusing the original finding/run pair would hit uniqueness first.
 assert.match(raw(`BEGIN; INSERT INTO lg_finding_occurrences(organization_id,project_id,finding_id,run_id,attempt_id,outcome) SELECT organization_id,project_id,'${labFinding}',run_id,id,'PASS' FROM lg_job_attempts WHERE project_id='${sourceProject}' LIMIT 1; ROLLBACK;`).stderr,/23503/);
 denied(outsider,`SELECT lg_finding_replay('${labProject}','${labFinding}','fixed','${randomUUID()}','${correlation}')`);
});
dbtest("sealed dynamic manifest and regression recipe are append-only",()=>{
 assert.match(raw(`UPDATE lg_reproduction_bundles SET manifest_digest='sha256:${"f".repeat(64)}' WHERE run_id='${labRun}'`).stderr,/23514|42501/);
 assert.match(raw(`UPDATE lg_regression_tests SET artifact='{}' WHERE id='${labRegression}'`).stderr,/23514|42501/);
});
dbtest("dynamic evidence remains bound to immutable deployment, invariant and authorization",()=>{
 assert.equal(execute(`SELECT count(*) FROM lg_reproduction_bundles b JOIN lg_verification_runs r ON r.id=b.run_id JOIN lg_test_cases c ON c.run_id=r.id WHERE r.project_id='${labProject}' AND b.bundle->>'deploymentId'=r.deployment_id::text AND b.bundle->>'authorizationId'=r.authorization_id::text AND b.bundle->>'invariantId'=c.invariant_id::text AND b.bundle->>'planHash'=c.plan_hash`),"4");
 assert.equal(execute(`SELECT count(*) FROM lg_deployments WHERE project_id='${labProject}' AND provider='VERCEL'`),"0");
});
dbtest("completed replay retry is idempotent and cannot reopen a resolved finding",()=>{
 const retry=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${labProject}','${labFinding}','fixed','${labLastRequest}','${correlation}')`);
 assert.equal(retry,labLastReplay);assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"RESOLVED");
 denied(owner,`SELECT lg_finding_replay('${labProject}','${labFinding}','vulnerable','${labLastRequest}','${correlation}')`,"22023");
});
dbtest("cancelled replay becomes inconclusive; old idempotency retry cannot replace active replay",()=>{
 const pending=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${labProject}','${labFinding}','fixed','${randomUUID()}','${correlation}')`);
 execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${labProject}','${labFinding}','fixed','${labLastRequest}','${correlation}')`);
 assert.equal(query(owner,`SELECT active_replay FROM lg_findings WHERE id='${labFinding}'`),pending);
 execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_execution_command('${labProject}','CANCEL','{"runId":"${pending}"}','${correlation}')`);executionService("RECOVER");
 assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${labFinding}'`),"INCONCLUSIVE");assert.equal(query(owner,`SELECT state FROM lg_verification_runs WHERE id='${pending}'`),"CANCELLED");
});

// Phase 6 uses exactly the same admission, finding, replay and regression tables.
let billingOrg:string,billingProject:string,billingFinding:string;
dbtest("Phase 6 forward migration expands only controlled lab capabilities",()=>{
 execute(readFileSync("migrations/022_launchgate_billing_lab.sql","utf8"));
 billingOrg=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_organization('Phase 6 synthetic billing','${correlation}')`);
 billingProject=execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_project('${billingOrg}','No live money','${correlation}')`);
 denied(owner,"SELECT launchgate_private.lab_create(NULL,NULL,'{}',NULL)");
});
for(const caseId of ["billing.failed","billing.duplicate","billing.price","billing.authorized","billing.cancel","billing.expiry","billing.concurrent"] as const)
 dbtest(`Phase 6 durable billing journey ${caseId}: reproduce, find, fixed replay, regression`,async()=>{
 const {generateKeyPairSync}=await import("node:crypto"),{mkdtemp,rm}=await import("node:fs/promises"),{tmpdir}=await import("node:os"),{join,resolve,sep}=await import("node:path");
 const {compilePlan,defaultCapabilities,labInvariant}=await import("../../reference-lab/plans");const {registerLabRun,LocalLabProvider}=await import("../../reference-lab/host");
 const {Orchestrator}=await import("../../services/orchestrator/orchestrator"),{LocalArtifacts}=await import("../../services/orchestrator/artifacts");
 const plan=compilePlan(labInvariant(caseId,randomUUID()),caseId,"phase6-durable",defaultCapabilities(caseId));
 const store={async command(action:string,data:Record<string,unknown>){return executionService(action,data);}};
 const root=await mkdtemp(join(tmpdir(),"launchgate-phase6-")),keys=generateKeyPairSync("ed25519"),artifacts=new LocalArtifacts(root);
 const provider=new LocalLabProvider(keys.publicKey,store,artifacts),orchestrator=new Orchestrator(store,provider,keys.privateKey,artifacts);
 const process=async(run:string)=>{await orchestrator.tick();await provider.drain();await orchestrator.tick();const value=provider.results.get(run);assert.ok(value);assert.equal(query(owner,`SELECT state FROM lg_verification_runs WHERE id='${run}'`),"COMPLETED");assert.ok(value.traces.every(t=>t.billing?.financialSpend===0));return value;};
 try{
  const created=await registerLabRun(store,billingProject,owner,plan,"vulnerable") as {id:string};const original=await process(created.id);assert.equal(original.evaluation.outcome,"REPRODUCIBLE_FAILURE");
  billingFinding=execute(`SELECT finding_id FROM lg_finding_occurrences WHERE run_id='${created.id}'`);
  const replay=(variant:string)=>execute(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${billingProject}','${billingFinding}','${variant}','${randomUUID()}','${correlation}')`);
  const fixed=await process(replay("fixed"));assert.equal(fixed.evaluation.outcome,"PASS");assert.equal(fixed.bundle.planHash,original.bundle.planHash);assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${billingFinding}'`),"RESOLVED");
  assert.equal(query(owner,`SELECT artifact->>'expectedOutcome' FROM lg_regression_tests WHERE finding_id='${billingFinding}'`),"PASS");
  if(caseId==="billing.duplicate"){const again=await process(replay("vulnerable"));assert.equal(again.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(query(owner,`SELECT state FROM lg_findings WHERE id='${billingFinding}'`),"REGRESSION_FAILED");}
  assert.equal(execute(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${billingOrg}'`),"0:0");
  assert.equal(execute(`SELECT consumed=(SELECT sum(requests) FROM lg_job_attempts WHERE organization_id='${billingOrg}') FROM lg_execution_budgets WHERE organization_id='${billingOrg}'`),"t");
 }finally{await provider.drain().catch(()=>{});const target=resolve(root);assert.ok(target.startsWith(resolve(tmpdir())+sep+"launchgate-phase6-"));await rm(target,{recursive:true,force:true});}
});
for(const table of ["lg_test_attempts","lg_observations","lg_findings","lg_reproduction_bundles","lg_regression_tests"])
 dbtest(`Phase 6 populated billing ${table}: tenant isolation and browser forgery denial`,()=>{
  assert.equal(query(outsider,`SELECT count(*) FROM ${table} WHERE project_id='${billingProject}'`),"0");assert.ok(Number(query(owner,`SELECT count(*) FROM ${table} WHERE project_id='${billingProject}'`))>0);
  denied(owner,`UPDATE ${table} SET project_id='${otherProject}' WHERE project_id='${billingProject}'`);
 });
dbtest("Phase 6 provider/payment/entitlement observations are sealed, synthetic and zero spend",()=>{
 assert.equal(execute(`SELECT bool_and(trace#>>'{billing,financialSpend}'='0' AND jsonb_array_length(trace#>'{billing,events}')>0) FROM lg_test_attempts WHERE project_id='${billingProject}'`),"t");
 assert.equal(execute(`SELECT count(*) FROM lg_reproduction_bundles WHERE project_id='${billingProject}'`),"15");
 denied(owner,executionSql("LAB_COMPLETE",{outcome:"PASS",candidate:true}));
 assert.match(raw(`UPDATE lg_test_attempts SET trace=jsonb_set(trace,'{billing,financialSpend}','1') WHERE project_id='${billingProject}'`).stderr,/42501|23514/);
 assert.equal(execute(`SELECT count(*) FROM lg_target_authorizations WHERE project_id='${billingProject}' AND (spend_micros<>0 OR request_limit<>64 OR duration_seconds<>120)`),"0");
});
