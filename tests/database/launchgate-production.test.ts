import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { registerLabRun } from "../../reference-lab/host";
import { compilePlan, defaultCapabilities, labInvariant } from "../../reference-lab/plans";
const container=`launchgate-production-${randomUUID()}`;
const docker=(args:string[],input?:string)=>spawnSync("docker",args,{input,encoding:"utf8",timeout:120000,windowsHide:true,maxBuffer:32*1024*1024});
const blocked=docker(["info","--format","{{.ServerVersion}}"]).status!==0;
const dbtest=(name:string,fn:()=>void|Promise<void>)=>test(name,{skip:blocked&&process.env.LAUNCHGATE_REQUIRE_DATABASE!=="1"?"Docker unavailable":false},fn);
let started=false,org:string,project:string,attempt:string,run:string,resource:string;
const owner=randomUUID(),outsider=randomUUID(),correlation=randomUUID();
function sql(statement:string,database="launchgate_test"){const r=docker(["exec","-i",container,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d",database],statement);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const literal=(data:unknown)=>`'${JSON.stringify(data).replaceAll("'","''")}'::jsonb`;
const rpc=(action:string,data:Record<string,unknown>)=>JSON.parse(sql(`SET ROLE service_role;SELECT lg_operations_service('${action}',${literal({environment:"test",...data})});`)||"null");
function denied(statement:string){const r=docker(["exec","-i",container,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","launchgate_test"],statement);assert.notEqual(r.status,0);}
const scope=()=>({environment:"test",organizationId:org,runId:run,attemptId:attempt});
before(async()=>{
 if(blocked){if(process.env.LAUNCHGATE_REQUIRE_DATABASE==="1")throw new Error("Docker required");return;}
 const r=docker(["run","--detach","--name",container,"--label","launchgate.disposable=true","--label","launchgate.phase=10","--network","none","--env","POSTGRES_HOST_AUTH_METHOD=trust","--env","POSTGRES_DB=launchgate_test","postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"]);assert.equal(r.status,0,r.stderr);started=true;
 let ready=false;for(let n=0;n<40;n++){if(docker(["exec",container,"pg_isready","-U","postgres"]).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
 sql(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
 for(const file of readdirSync("migrations").filter(f=>/^0\d+.*\.sql$/.test(f)).sort())sql(readFileSync(`migrations/${file}`,"utf8"));
 sql(`INSERT INTO auth.users VALUES('${owner}'),('${outsider}');`);
 org=sql(`SET ROLE authenticated;SET request.jwt.claim.sub='${owner}';SELECT id FROM lg_create_organization('Phase 10 isolated qualification','${correlation}');`);
 project=sql(`SET ROLE authenticated;SET request.jwt.claim.sub='${owner}';SELECT id FROM lg_create_project('${org}','Operations','${correlation}');`);
 const execution={async command(action:string,data:Record<string,unknown>){return JSON.parse(sql(`SET ROLE service_role;SELECT lg_execution_service('${action}',${literal({environment:"test",...data})});`)||"null");}};
 const plan=compilePlan(labInvariant("tenant.read",randomUUID()),"tenant.read","phase10",defaultCapabilities("tenant.read"));await registerLabRun(execution,project,owner,plan,"fixed");
 const claim=await execution.command("CLAIM",{workerId:randomUUID()});attempt=claim.attempt.id;run=claim.run.id;
});
after(()=>{if(started){assert.equal(docker(["inspect","--format",'{{index .Config.Labels "launchgate.phase"}}',container]).stdout.trim(),"10");const volumes=JSON.parse(docker(["inspect","--format","{{json .Mounts}}",container]).stdout).filter((m:{Type:string})=>m.Type==="volume").map((m:{Name:string})=>m.Name) as string[];assert.equal(docker(["rm","--force","--volumes",container]).status,0);assert.notEqual(docker(["inspect",container]).status,0);for(const volume of volumes)assert.notEqual(docker(["volume","inspect",volume]).status,0);}});
dbtest("Phase 10 durable resource ownership, idempotency and scope",()=>{
 const data={scope:scope(),kind:"SANDBOX",provider:"contract-test",externalId:`test/${org}/${run}/${attempt}`,expiresAt:new Date(Date.now()+60000).toISOString()};
 resource=rpc("REGISTER",data).id;assert.equal(rpc("REGISTER",data).id,resource);
 denied(`SET ROLE service_role;SELECT lg_operations_service('REGISTER',${literal({...data,externalId:"unrelated"})});`);
 denied(`SET ROLE service_role;SELECT lg_operations_service('REGISTER',${literal({...data,scope:{...scope(),organizationId:randomUUID()}})});`);
 assert.equal(rpc("ATTEMPT",{attemptId:attempt,environment:"production"}).length,0);
 const artifact={...data,kind:"ARTIFACT",provider:"private-artifacts"},first=rpc("REGISTER",artifact);
 assert.equal(rpc("REGISTER",{...artifact,expiresAt:new Date(Date.now()+120000).toISOString()}).expiresAt,first.expiresAt);
 rpc("DESTROYED",{scope:scope(),kind:"ARTIFACT"});rpc("DESTROYED",{scope:scope(),kind:"ARTIFACT"});
});
for(const table of ["lg_operational_resources","lg_provider_qualifications","lg_operational_events"])dbtest(`Phase 10 ${table} forced RLS and browser mutation denied`,()=>{
 assert.equal(sql(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='${table}'::regclass`),"t");
 assert.equal(sql(`SET ROLE authenticated;SET request.jwt.claim.sub='${outsider}';SELECT count(*) FROM ${table}`),"0");
 denied(`SET ROLE authenticated;SET request.jwt.claim.sub='${owner}';DELETE FROM ${table};`);
});
dbtest("Phase 10 capability verification is trusted-service-only, live-bound and immutable",()=>{
 const data={organizationId:org,environment:"test",capability:"github.live",status:"VERIFIED",live:false,evidenceDigest:`sha256:${"a".repeat(64)}`,expiresAt:new Date(Date.now()+60000).toISOString()};
 denied(`SET ROLE authenticated;SELECT lg_operations_service('QUALIFY',${literal(data)});`);
 denied(`SET ROLE service_role;SELECT lg_operations_service('QUALIFY',${literal(data)});`);
 rpc("QUALIFY",{...data,status:"UNVERIFIED"});assert.equal(rpc("QUALIFICATIONS",{organizationId:org,environment:"test"}).length,1);
 denied("UPDATE lg_provider_qualifications SET status='VERIFIED',live=true;");denied("DELETE FROM lg_operational_events;");
});
dbtest("Phase 10 reaper fencing survives process restart and preserves failed cleanup",()=>{
 rpc("EXPIRE",{scope:scope(),kind:"SANDBOX"});const firstWorker=randomUUID(),secondWorker=randomUUID();const first=rpc("REAP_CLAIM",{workerId:firstWorker});assert.equal(first.id,resource);
 assert.equal(rpc("REAP_CLAIM",{workerId:secondWorker}),null);
 // Administrative clock simulation in disposable DB only, not a production RPC.
 sql(`UPDATE lg_operational_resources SET lease_until=clock_timestamp()-interval '1 second' WHERE id='${resource}'`);
 const second=rpc("REAP_CLAIM",{workerId:secondWorker});assert.equal(second.fence,first.fence+1);
 denied(`SET ROLE service_role;SELECT lg_operations_service('REAP_DONE',${literal({id:resource,fence:first.fence,workerId:firstWorker})});`);
 rpc("REAP_FAILED",{id:resource,fence:second.fence,workerId:secondWorker});assert.equal(sql(`SELECT state FROM lg_operational_resources WHERE id='${resource}'`),"ACTIVE");
 rpc("EXPIRE",{scope:scope(),kind:"SANDBOX"});const third=rpc("REAP_CLAIM",{workerId:secondWorker});rpc("REAP_DONE",{id:resource,fence:third.fence,workerId:secondWorker});assert.equal(rpc("LEAKS",{}).length,0);
});
dbtest("Phase 10 isolated metadata backup restore retains RLS, qualification and audit history",()=>{
 const dump=docker(["exec",container,"pg_dump","-U","postgres","-d","launchgate_test","--no-owner"]);assert.equal(dump.status,0,dump.stderr);
 sql("CREATE DATABASE launchgate_restore;","postgres");sql(dump.stdout,"launchgate_restore");
 for(const table of ["lg_operational_resources","lg_provider_qualifications","lg_operational_events"]){assert.equal(sql(`SELECT count(*) FROM ${table}`,"launchgate_restore"),sql(`SELECT count(*) FROM ${table}`));assert.equal(sql(`SET ROLE authenticated;SET request.jwt.claim.sub='${outsider}';SELECT count(*) FROM ${table}`,"launchgate_restore"),"0");}
 assert.equal(sql(`SELECT state FROM lg_operational_resources WHERE id='${resource}'`,"launchgate_restore"),"DESTROYED");
});
dbtest("Phase 10 failed runner reservation recovers through existing durable cleanup",()=>{
 sql(`UPDATE lg_job_attempts SET deadline=clock_timestamp()-interval '1 second' WHERE id='${attempt}';`);
 const execute=(action:string,data:unknown)=>JSON.parse(sql(`SET ROLE service_role;SELECT lg_execution_service('${action}',${literal(data)});`)||"null");
 execute("RECOVER",{});const workerId=randomUUID(),cleanup=execute("CLEANUP_CLAIM",{workerId});assert.ok(cleanup);execute("CLEANUP_DONE",{attemptId:cleanup.attempt.id,fence:cleanup.attempt.fence,workerId});
 assert.equal(sql(`SELECT active||':'||reserved FROM lg_execution_budgets WHERE organization_id='${org}'`),"0:0");assert.equal(rpc("LEAKS",{}).length,0);
});
