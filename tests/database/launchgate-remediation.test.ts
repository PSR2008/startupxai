import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { compilePlan, defaultCapabilities, labInvariant, planHash } from "../../reference-lab/plans";
import { registerLabRun, LocalLabProvider } from "../../reference-lab/host";
import { Orchestrator } from "../../services/orchestrator/orchestrator";
import { RemediationWorker } from "../../services/remediation/worker";
import { DeterministicRemediationProvider } from "../../services/remediation/provider";
import { registeredLabDriver } from "../../services/remediation/lab-driver";
import { invariantSetDigest } from "../../services/releases/engine";
import type { ReleasePolicy } from "../../services/releases/contracts";
const docker = (args: string[], input?: string) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000, windowsHide: true });
const blocked = docker(["info", "--format", "{{.ServerVersion}}"]).status !== 0;
const container = `launchgate-remediation-${randomUUID()}`;
let started = false;
const owner = randomUUID(), outsider = randomUUID(), developer = randomUUID(), correlation = randomUUID();
let org: string, project: string;
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
  assert.notEqual(result.status, 0); assert.match(result.stderr, /permission denied|access|immutable|append.only|actor|release|policy|capability|scope/i);
}
const dbtest = (name: string, fn: () => void | Promise<void>) => test(name, { skip: blocked && process.env.LAUNCHGATE_REQUIRE_DATABASE !== "1" ? "Docker unavailable" : false }, fn);
before(async () => {
  if (blocked) { if (process.env.LAUNCHGATE_REQUIRE_DATABASE === "1") throw new Error("Docker required"); return; }
  const run = docker(["run", "--detach", "--name", container, "--label", "launchgate.disposable=true", "--label", "launchgate.phase=9", "--network", "none", "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", "POSTGRES_DB=launchgate_test", "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"]);
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
  if (started) { assert.equal(docker(["inspect", "--format", '{{index .Config.Labels "launchgate.phase"}}', container]).stdout.trim(), "9"); assert.equal(docker(["rm", "--force", "--volumes", container]).status, 0); }
});

const fixCommand = (action: string, data: Record<string, unknown>, user = owner) => JSON.parse(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; SELECT lg_fix_command('${project}','${action}',${literal(data)},'${correlation}');`));
for (const [caseId, adjacent, badFix, infrastructureFailure] of [["tenant.read", "tenant.write", false, false], ["role.member_owner", "role.member_admin", false, false], ["billing.duplicate", "billing.concurrent", false, false], ["ai.quota", "ai.concurrent", false, false], ["tenant.read", "tenant.write", true, false], ["tenant.read", "tenant.write", false, true]] as const) dbtest(`Phase 9 durable ${caseId} ${infrastructureFailure ? "runner failure releases resources" : badFix ? "bad fix remains inconclusive" : "patch, preview, verified resolution and recurrence"}`, async () => {
  const originPlan = compilePlan(labInvariant(caseId, randomUUID()), caseId, "phase9", defaultCapabilities(caseId));
  const adjacentPlan = compilePlan(labInvariant(adjacent, randomUUID()), adjacent, "phase9", defaultCapabilities(adjacent));
  const fixPolicy: ReleasePolicy = { ...policy, id: randomUUID(), requiredFamilies: [originPlan.family], requirements: [originPlan, adjacentPlan].map(p => ({ ...policy.requirements[0], invariant: p.spec, family: p.family, kind: "REGRESSION", planHash: planHash(p) })) };
  command("POLICY", { name: "Remediation required regressions", policy: fixPolicy, invariantSetDigest: invariantSetDigest(fixPolicy) });
  let dispatchChecked=false,verificationStarted=false; const errors:string[]=[];
  const keys = generateKeyPairSync("ed25519"), execution = { async command(a: string, d: Record<string, unknown>) {
    if(infrastructureFailure&&verificationStarted&&a==="REQUEST")throw new Error("SIMULATED_RUNNER_DISCONNECT");
    if(a==="CLAIM"&&d.remediationReleaseId&&!dispatchChecked){
      dispatchChecked=true;
      assert.equal(await asyncRpc("lg_execution_service","CLAIM",{workerId:randomUUID()}),null);
      assert.equal(await asyncRpc("lg_execution_service","CLAIM",{workerId:randomUUID(),remediationReleaseId:randomUUID()}),null);
      assert.equal(await asyncRpc("lg_release_service","CLAIM",{workerId:randomUUID()}),null);
    }
    return asyncRpc("lg_execution_service", a, d);
  } };
  const artifacts = { async put(attempt: string, id: string) { return `${attempt}/${id}`; }, async removeAttempt() {} };
  const provider = new LocalLabProvider(keys.publicKey, execution, artifacts), orchestration = new Orchestrator(execution, provider, keys.privateKey, artifacts);
  const store = { command: (a: string, d: Record<string, unknown>) => asyncRpc("lg_fix_service", a, d) };
  const driver = registeredLabDriver({ execution, releases: { command: (a,d) => asyncRpc("lg_release_service",a,d) }, artifacts, ...keys, plans: new Map([[adjacentPlan.spec.id, adjacentPlan]]), badFix });
  const fixes = new RemediationWorker(store, new DeterministicRemediationProvider(), driver, error => { errors.push(error instanceof Error?error.message:"UNKNOWN"); });
  try {
    await registerLabRun(execution, project, owner, originPlan, "vulnerable"); await orchestration.tick(); await provider.drain(); await orchestration.tick();
    const findingId = sql(`SELECT id FROM lg_findings WHERE invariant_id='${originPlan.spec.id}' AND state='REPRODUCED'`); assert.ok(findingId);
    const request = { findingId, policyId: fixPolicy.id, policyVersion: 1, requestKey: randomUUID() };
    const proposal = fixCommand("REQUEST", request); assert.equal(fixCommand("REQUEST", request).id, proposal.id);
    assert.equal((await fixes.tick() as {state:string}).state, "PROPOSED");
    fixCommand("VALIDATE", { proposalId: proposal.id, requestKey: randomUUID() });
    assert.equal((await fixes.tick() as {state:string}).state, "READY_FOR_PR");
    assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`), "REPRODUCED");
    const prRequest = { proposalId: proposal.id, requestKey: randomUUID() }; fixCommand("PR", prRequest);
    assert.equal((await fixes.tick() as {state:string}).state, "PR_CREATED"); fixCommand("PR", prRequest);
    assert.equal(sql(`SELECT count(*) FROM lg_fix_pull_requests WHERE proposal_id='${proposal.id}'`), "1");
    assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`), "REPRODUCED");
    verificationStarted=true;fixCommand("VERIFY", { proposalId: proposal.id, requestKey: randomUUID() });
    const result = await fixes.tick(); assert.equal((result as {state:string}).state, badFix||infrastructureFailure ? "INCONCLUSIVE" : "VERIFIED", JSON.stringify({result,errors}));
    assert.equal(dispatchChecked,true);
    assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`), badFix||infrastructureFailure ? "INCONCLUSIVE" : "RESOLVED");
    assert.equal(sql(`SELECT count(*) FROM lg_regression_tests WHERE finding_id='${findingId}'`), "1");
    assert.equal(sql(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${org}'`),"0:0");
    if (!badFix&&!infrastructureFailure) {
      const proof = JSON.parse(sql(`SELECT evidence FROM lg_fix_verification_runs WHERE proposal_id='${proposal.id}'`));
      assert.notEqual(proof.fixSha, proof.vulnerableSha); assert.notEqual(proof.fixDeployment, proof.vulnerableDeployment); assert.equal(proof.coverage.length, 2);
      sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_finding_replay('${project}','${findingId}','vulnerable','${randomUUID()}','${correlation}');`);
      await orchestration.tick(); await provider.drain(); await orchestration.tick();
      assert.equal(sql(`SELECT state FROM lg_findings WHERE id='${findingId}'`), "REGRESSION_FAILED");
      assert.equal(sql(`SELECT state FROM lg_fix_verification_runs WHERE proposal_id='${proposal.id}'`), "VERIFIED");
      denied(`UPDATE lg_fix_verification_runs SET state='INCONCLUSIVE' WHERE proposal_id='${proposal.id}';`);
      denied(`UPDATE lg_fix_proposals SET source_sha='${"f".repeat(40)}' WHERE id='${proposal.id}';`);
    }
  } finally { await provider.drain().catch(() => {}); for (const result of provider.results.values()) { await provider.terminate(result.bundle.attemptId); await provider.cleanup(result.bundle.attemptId); } }
});
for (const table of ["lg_fix_proposals", "lg_patch_artifacts", "lg_fix_pull_requests", "lg_fix_verification_runs", "lg_remediation_capabilities", "lg_fix_events"]) dbtest(`Phase 9 ${table}: RLS and browser forgery denied`, () => {
  assert.equal(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM ${table};`), "0");
  assert.equal(sql(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='${table}'::regclass`), "t");
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; DELETE FROM ${table};`);
});
dbtest("Phase 9 privileged decisions and consent cannot be forged", () => {
  denied(`SET ROLE authenticated; SELECT lg_fix_service('COMPLETE','{}');`);
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${developer}'; SELECT lg_fix_command('${project}','REQUEST',${literal({requestKey:randomUUID(),findingId:randomUUID(),policyId:policy.id,policyVersion:1})},'${correlation}');`);
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; UPDATE lg_findings SET state='RESOLVED';`);
  denied(`UPDATE lg_patch_artifacts SET patch_hash='sha256:${"a".repeat(64)}';`);
});
dbtest("Phase 9 verified write capability is optional, repository scoped and revocable", () => {
  const installation=randomUUID(),repository=randomUUID(),connection=randomUUID();
  sql(`INSERT INTO lg_github_installations(id,organization_id,app_id,installation_id,account_id,status) VALUES('${installation}','${org}',88,99,100,'ACTIVE');
    INSERT INTO lg_installation_repositories(id,organization_id,installation_id,repository_id,owner_login,name,visibility,default_branch) VALUES('${repository}','${org}','${installation}',101,'fixture','remediation','PRIVATE','main');
    INSERT INTO lg_repository_connections(id,organization_id,project_id,repository_id,created_by) VALUES('${connection}','${org}','${project}','${repository}','${owner}');`);
  const input={projectId:project,connectionId:connection,actorId:owner};
  assert.equal(JSON.parse(sql(rpcSql("lg_fix_service","CAPABILITY_CONTEXT",input))).repositoryId,101);
  denied(rpcSql("lg_fix_service","CAPABILITY_VERIFIED",{...input,repositoryId:102,appId:123,installationId:456}));
  denied(rpcSql("lg_fix_service","CAPABILITY_VERIFIED",{...input,repositoryId:101,appId:88,installationId:456}));
  const cap=JSON.parse(sql(rpcSql("lg_fix_service","CAPABILITY_VERIFIED",{...input,repositoryId:101,appId:123,installationId:456})));
  assert.equal(cap.enabled,true);assert.equal(cap.repository_id,101);
  assert.equal(sql(`SELECT expires_at-verified_at=interval '1 hour' FROM lg_remediation_capabilities WHERE id='${cap.id}'`),"t");
  assert.equal(sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${outsider}'; SELECT count(*) FROM lg_remediation_capabilities;`),"0");
  denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${developer}'; SELECT lg_fix_capability_revoke('${project}','${cap.id}','${correlation}');`);
  sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SELECT lg_fix_capability_revoke('${project}','${cap.id}','${correlation}');`);
  assert.equal(sql(`SELECT enabled FROM lg_remediation_capabilities WHERE id='${cap.id}'`),"f");
});
