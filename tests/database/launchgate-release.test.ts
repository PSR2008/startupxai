import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { compilePlan, defaultCapabilities, labInvariant, planHash } from "../../reference-lab/plans";
import { labSourceIdentity, LocalLabProvider } from "../../reference-lab/host";
import { Orchestrator } from "../../services/orchestrator/orchestrator";
import { ReleaseWorker } from "../../services/releases/worker";
import { invariantSetDigest } from "../../services/releases/engine";
import type { ReleasePolicy } from "../../services/releases/contracts";
const docker = (args: string[], input?: string) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000, windowsHide: true });
const blocked = docker(["info", "--format", "{{.ServerVersion}}"]).status !== 0;
const container = `launchgate-release-${randomUUID()}`;
let started = false;
const owner = randomUUID(), outsider = randomUUID(), developer = randomUUID(), worker = randomUUID(), correlation = randomUUID();
let org: string, project: string, releaseId: string;
const plans = ["auth.api", "tenant.read", "role.member_owner", "billing.failed", "billing.duplicate", "ai.quota", "ai.distributed", "browser.release"].map(id => compilePlan(labInvariant(id as Parameters<typeof labInvariant>[0], randomUUID()), id as Parameters<typeof labInvariant>[0], "phase8-durable", defaultCapabilities(id as Parameters<typeof labInvariant>[0])));
const policy: ReleasePolicy = { id: randomUUID(), version: 1, blockingSeverities: ["critical", "high"], requiredFamilies: [...new Set(plans.map(p => p.family))],
  requirements: plans.map(p => ({ invariant: p.spec, required: true, baseline: true, kind: p.journey ? "JOURNEY" : "INVARIANT", family: p.family, runnerVersion: "lg-runner-1", testVersion: "lab-test-1", fixtureVersion: 1, planHash: planHash(p), estimatedCost: p.budget.requests, applicabilityProof: null })),
  freshnessSeconds: 1800, environments: ["SANDBOX"], minimumCoverage: 1, requiredInconclusive: "NON_APPROVAL", allowExceptions: true, maximumExceptionSeconds: 3600 };
function sql(statement: string) {
  const result = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "launchgate_test"], statement);
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const rpcSql = (name: string, action: string, data: Record<string, unknown>) => `SET ROLE service_role; SELECT ${name}('${action}',${literal(data)});`;
const service = (action: string, data: Record<string, unknown>) => JSON.parse(sql(rpcSql("lg_release_service", action, data)) || "null");
function command(action: string, data: unknown, user = owner) { return sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; SELECT lg_release_command('${project}','${action}',${literal(data)},'${correlation}');`); }
async function asyncRpc(name: string, action: string, data: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "launchgate_test"], { windowsHide: true, timeout: 120000 });
    let out = "", err = ""; child.stdout.on("data", c => { out += c; }); child.stderr.on("data", c => { err += c; }); child.on("error", reject); child.stdin.on("error", reject);
    child.on("close", code => code === 0 ? resolve(JSON.parse(out.trim() || "null")) : reject(new Error(err))); child.stdin.end(rpcSql(name, action, data));
  });
}
function denied(statement: string) {
  const result = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "launchgate_test"], statement);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /permission denied|access|immutable|append.only|actor|release|policy/i);
}
const dbtest = (name: string, fn: () => void | Promise<void>) => test(name, { skip: blocked && process.env.LAUNCHGATE_REQUIRE_DATABASE !== "1" ? "Docker unavailable" : false }, fn);
before(async () => {
  if (blocked) { if (process.env.LAUNCHGATE_REQUIRE_DATABASE === "1") throw new Error("Docker required"); return; }
  const run = docker(["run", "--detach", "--name", container, "--label", "launchgate.disposable=true", "--label", "launchgate.phase=8", "--network", "none", "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_DB=launchgate_test", "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"]);
  assert.equal(run.status, 0, run.stderr); started = true;
  let ready = false; for (let n = 0; n < 40; n++) { if (docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0) { ready = true; break; } await new Promise(r => setTimeout(r, 250)); } assert.ok(ready);
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
  for (const file of readdirSync("migrations").filter(f => /^0\d+.*\.sql$/.test(f)).sort()) sql(readFileSync(`migrations/${file}`, "utf8"));
  sql(`INSERT INTO auth.users VALUES('${owner}'),('${outsider}'),('${developer}');`);
  org = sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_organization('Phase 8 release test','${correlation}');`);
  project = sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT id FROM lg_create_project('${org}','Cross domain','${correlation}');`);
  sql(`INSERT INTO lg_organization_memberships(organization_id,user_id,role) VALUES('${org}','${developer}','DEVELOPER');`);
});
after(() => {
  if (started) { assert.equal(docker(["inspect", "--format", '{{index .Config.Labels "launchgate.phase"}}', container]).stdout.trim(), "8"); assert.equal(docker(["rm", "--force", "--volumes", container]).status, 0); }
});
dbtest("Phase 8 migrations, versioned policy and exact release creation", () => {
  command("POLICY", { name: "Cross domain release", policy, invariantSetDigest: invariantSetDigest(policy) });
  const dep = service("LAB_DEPLOYMENT", { projectId: project, actorId: owner, ...labSourceIdentity() });
  const input = { projectId: project, actorId: owner, policyId: policy.id, policyVersion: 1, deploymentId: dep.deploymentId };
  const candidate = service("CREATE", input); releaseId = candidate.id;
  assert.equal(service("CREATE", input).id, releaseId); assert.equal(candidate.identity.candidate.commitSha, labSourceIdentity().revision);
  assert.equal(candidate.identity.provider, "REFERENCE_LAB"); assert.equal(candidate.snapshot_id, null);
});
for (const table of ["lg_verification_policies", "lg_policy_versions", "lg_policy_invariants", "lg_release_candidates", "lg_release_states", "lg_release_runs", "lg_policy_exceptions", "lg_invariant_dependencies", "lg_regression_dependencies", "lg_gate_evaluations", "lg_gate_evaluation_items", "lg_github_check_runs", "lg_release_events", "lg_release_configurations"])
  dbtest(`Phase 8 ${table}: forced RLS and browser write denial`, () => {
    assert.equal(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM ${table};`), "0");
    denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; DELETE FROM ${table};`);
    assert.equal(sql(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='${table}'::regclass`), "t");
  });
dbtest("Phase 8 service gateway and policy versions cannot be forged by browser", () => {
  denied(`SET ROLE authenticated; SELECT lg_release_service('COMPLETE','{}');`);
  denied(`UPDATE lg_policy_versions SET version=2 WHERE policy_id='${policy.id}';`);
  denied(`UPDATE lg_release_candidates SET commit_sha='${"b".repeat(40)}' WHERE id='${releaseId}';`);
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${developer}'; SELECT lg_release_command('${project}','POLICY',${literal({ name: "forged", policy, invariantSetDigest: invariantSetDigest(policy) })},'${correlation}');`);
});
dbtest("Phase 8 release leases fence concurrent workers", () => {
  const claim = service("CLAIM", { workerId: worker }); assert.equal(claim.releaseId, releaseId);
  assert.equal(service("CLAIM", { workerId: randomUUID() }), null);
  denied(rpcSql("lg_release_service", "CHECK", { ...claim, workerId: randomUUID() }));
  service("RELEASE", { ...claim, workerId: worker });
});
dbtest("Phase 8 durable cross-domain scheduling, execution, gate and history", async () => {
  const keys = generateKeyPairSync("ed25519"), execution = { command: (a: string, d: Record<string, unknown>) => asyncRpc("lg_execution_service", a, d) };
  const artifacts = { async put(attempt: string, id: string) { return `${attempt}/${id}`; }, async removeAttempt() {} };
  const provider = new LocalLabProvider(keys.publicKey, execution, artifacts), orchestrator = new Orchestrator(execution, provider, keys.privateKey, artifacts);
  const releases = new ReleaseWorker({ command: (a,d) => asyncRpc("lg_release_service", a,d) }, { lab: { identity: labSourceIdentity, plans: new Map(plans.map(plan => [plan.spec.id, { plan, variant: "fixed" as const }])) } });
  try {
    assert.equal(await releases.tick(), null);
    assert.equal(sql(`SELECT count(*) FROM lg_release_runs WHERE release_id='${releaseId}';`), "8");
    for (let n = 0; n < 9; n++) { await orchestrator.tick(); await provider.drain(); }
    const result = await releases.tick(); assert.equal(result?.decision, "SHIP", JSON.stringify(result)); assert.equal(result?.counts.PASS, 8);
    assert.deepEqual(result?.manifests,sql(`SELECT rb.manifest_digest FROM lg_reproduction_bundles rb JOIN lg_release_runs rr ON rr.run_id=rb.run_id WHERE rr.release_id='${releaseId}' ORDER BY rb.manifest_digest`).split("\n"));
    assert.equal(sql(`SELECT count(DISTINCT vr.deployment_id) FROM lg_release_runs rr JOIN lg_verification_runs vr ON vr.id=rr.run_id WHERE rr.release_id='${releaseId}'`), "1");
    assert.equal(sql(`SELECT count(*) FROM lg_gate_evaluation_items WHERE project_id='${project}' AND status='PASS'`), "8");
    assert.equal(sql(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${org}'`), "0:0");
    denied(`UPDATE lg_gate_evaluations SET decision='BLOCK' WHERE release_id='${releaseId}';`);
  } finally { await provider.drain().catch(() => {}); for (const result of provider.results.values()) { await provider.terminate(result.bundle.attemptId); await provider.cleanup(result.bundle.attemptId); } }
});
dbtest("Phase 8 populated gate history remains isolated and immutable", () => {
  assert.equal(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM lg_gate_evaluations;`), "0");
  assert.equal(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT count(*) FROM lg_gate_evaluations WHERE release_id='${releaseId}';`), "1");
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; INSERT INTO lg_gate_evaluation_items VALUES('${org}','${project}','${randomUUID()}','${plans[0].spec.id}','PASS','{}');`);
});
dbtest("Phase 8 exceptions require owner/admin, are audited and preserve evidence", () => {
  const input = { releaseId, invariantId: plans[0].spec.id, findingId: null, reason: "Temporary provider limitation", expiresAt: new Date(Date.now() + 600000).toISOString(), ticket: null };
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${developer}'; SELECT lg_release_command('${project}','EXCEPTION',${literal(input)},'${correlation}');`);
  const waiver = JSON.parse(command("EXCEPTION", input)); command("REVOKE_EXCEPTION", { releaseId, exceptionId: waiver.id });
  assert.equal(sql(`SELECT count(*) FROM lg_release_events WHERE release_id='${releaseId}' AND kind IN ('EXCEPTION_CREATED','EXCEPTION_REVOKED');`), "2");
  assert.equal(sql(`SELECT decision FROM lg_gate_evaluations WHERE release_id='${releaseId}'`), "SHIP");
});
dbtest("Phase 8 signed delivery identity deduplication is durable", () => {
  const data = { appId: 12, installationId: 34, repositoryId: 56, deliveryId: randomUUID(), headSha: "a".repeat(40), baseSha: "b".repeat(40), digest: "c".repeat(64) };
  service("DELIVERY", data); service("DELIVERY", data); assert.equal(sql(`SELECT count(*) FROM launchgate_private.release_deliveries WHERE delivery_id='${data.deliveryId}'`), "1");
});
dbtest("Phase 8 automatic signed discovery waits for verified deployment and publishes non-approval without customer adapters",async()=>{
  const installation=randomUUID(),repository=randomUUID(),connection=randomUUID(),environment=randomUUID(),vercel=randomUUID(),deployment=randomUUID();
  sql(`INSERT INTO lg_github_installations(id,organization_id,app_id,installation_id,account_id,status) VALUES('${installation}','${org}',88,99,100,'ACTIVE');
    INSERT INTO lg_installation_repositories(id,organization_id,installation_id,repository_id,owner_login,name,visibility,default_branch) VALUES('${repository}','${org}','${installation}',101,'fixture','release','PRIVATE','main');
    INSERT INTO lg_repository_connections(id,organization_id,project_id,repository_id,created_by) VALUES('${connection}','${org}','${project}','${repository}','${owner}');
    INSERT INTO lg_environments(id,organization_id,project_id,name,type) VALUES('${environment}','${org}','${project}','Synthetic provider contract','SANDBOX');
    INSERT INTO lg_vercel_connections(id,organization_id,project_id,account_id,provider_project_id,credential_reference) VALUES('${vercel}','${org}','${project}','synthetic-account','synthetic-project','${randomUUID()}');`);
  command("CONFIGURE",{connectionId:connection,policyId:policy.id,policyVersion:1,environmentId:environment});
  const event={appId:88,installationId:99,repositoryId:101,deliveryId:randomUUID(),headSha:"a".repeat(40),baseSha:"b".repeat(40),digest:"d".repeat(64)};
  service("DELIVERY",event);service("DISCOVER",{});
  assert.equal(sql(`SELECT state FROM launchgate_private.release_deliveries WHERE delivery_id='${event.deliveryId}'`),"WAITING_FOR_DEPLOYMENT");
  assert.equal((service("PENDING_SNAPSHOTS",{}) as string[]).length,2);
  sql(`UPDATE lg_repository_snapshots SET state='COMPLETE',source_state='COMPLETE',tree_sha='${"c".repeat(40)}' WHERE connection_id='${connection}';
    INSERT INTO lg_deployments(id,organization_id,project_id,environment_id,connection_id,repository_connection_id,provider,provider_deployment_id,target_url,commit_sha,verification_state) VALUES('${deployment}','${org}','${project}','${environment}','${vercel}','${connection}','VERCEL','dpl_syntheticPhase8','https://synthetic-phase8.vercel.app/','${event.headSha}','PROVIDER_VERIFIED');`);
  const published:Array<{headSha:string;conclusion:string}>=[];
  const releaseWorker=new ReleaseWorker({command:(a,d)=>asyncRpc("lg_release_service",a,d)},{publisher:{async publishCheck(input,checkpoint){await checkpoint();published.push(input);return {checkId:42,headSha:input.headSha};}}});
  const result=await releaseWorker.tick();assert.equal(result?.decision,"INCONCLUSIVE");assert.equal(result?.counts.NOT_RUN,8);
  assert.ok(published.length>=2);assert.ok(published.every(p=>p.headSha===event.headSha&&p.conclusion==="action_required"));
  assert.equal(sql(`SELECT publication_state FROM lg_github_check_runs WHERE connection_id='${connection}'`),"PUBLISHED");
  service("DELIVERY",{...event,deliveryId:randomUUID(),digest:"e".repeat(64),rerun:true});
  assert.equal((await releaseWorker.tick())?.decision,"INCONCLUSIVE");
  assert.equal(sql(`SELECT count(*) FROM lg_gate_evaluations WHERE release_id IN (SELECT id FROM lg_release_candidates WHERE connection_id='${connection}')`),"2");
});
dbtest("Phase 8 durable finding regression reproduces, resolves and blocks reintroduction",async()=>{
  const plan=compilePlan(labInvariant("tenant.read",randomUUID()),"tenant.read","phase8-regression",defaultCapabilities("tenant.read"));
  const regressionPolicy:ReleasePolicy={...policy,id:randomUUID(),freshnessSeconds:30,requiredFamilies:[plan.family],requirements:[{...policy.requirements[0],invariant:plan.spec,family:plan.family,kind:"REGRESSION",planHash:planHash(plan)}]};
  command("POLICY",{name:"Required tenant regression",policy:regressionPolicy,invariantSetDigest:invariantSetDigest(regressionPolicy)});
  const dep=service("LAB_DEPLOYMENT",{projectId:project,actorId:owner,...labSourceIdentity()});
  const release=service("CREATE",{projectId:project,actorId:owner,policyId:regressionPolicy.id,policyVersion:1,deploymentId:dep.deploymentId});
  const keys=generateKeyPairSync("ed25519"),execution={command:(a:string,d:Record<string,unknown>)=>asyncRpc("lg_execution_service",a,d)};
  const artifacts={async put(attempt:string,id:string){return `${attempt}/${id}`;},async removeAttempt(){}};
  const provider=new LocalLabProvider(keys.publicKey,execution,artifacts),orchestrator=new Orchestrator(execution,provider,keys.privateKey,artifacts);
  const registry=new Map<string,{plan:typeof plan;variant:"fixed"|"vulnerable";findingId?:string}>([[plan.spec.id,{plan,variant:"vulnerable"}]]);
  const releases=new ReleaseWorker({command:(a,d)=>asyncRpc("lg_release_service",a,d)},{lab:{identity:labSourceIdentity,plans:registry}});
  const run=async()=>{await releases.tick();await orchestrator.tick();await provider.drain();await orchestrator.tick();return releases.tick();};
  try{
    assert.equal((await run())?.decision,"BLOCK");
    const findingId=sql(`SELECT id FROM lg_findings WHERE project_id='${project}' AND invariant_id='${plan.spec.id}'`);
    registry.set(plan.spec.id,{plan,variant:"fixed",findingId});command("REEVALUATE",{releaseId:release.id});
    assert.equal((await run())?.decision,"SHIP");assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`),"RESOLVED");
    registry.set(plan.spec.id,{plan,variant:"vulnerable",findingId});await new Promise(resolve=>setTimeout(resolve,31000));
    assert.equal((await run())?.decision,"BLOCK");assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`),"REGRESSION_FAILED");
    assert.equal(sql(`SELECT count(*) FROM lg_gate_evaluations WHERE release_id='${release.id}'`),"3");
    assert.equal(sql(`SELECT count(*) FROM lg_release_events WHERE release_id='${release.id}' AND kind='ASSURANCE_EXPIRED'`),"1");
  }finally{await provider.drain().catch(()=>{});for(const result of provider.results.values()){await provider.terminate(result.bundle.attemptId);await provider.cleanup(result.bundle.attemptId);}}
});
