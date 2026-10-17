import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { Orchestrator,grantFromClaim,type RunnerProvider } from "../services/orchestrator/orchestrator";
import { grantFixture } from "./fixtures/execution";
import { RunnerKeyRing } from "../services/production/rotation";
function claim(){const g=grantFixture();return {run:{id:g.runId,organization_id:g.organizationId,project_id:g.projectId,snapshot_id:g.snapshotId,commit_sha:g.commitSha,deployment_id:g.deploymentId,authorization_id:g.authorizationId,authorization_version:1,runner_image_digest:null},job:{id:g.jobId,fence:1},attempt:{id:g.attemptId,runner_id:g.runner.identity,grant_id:g.jti,deadline:new Date(g.exp*1000).toISOString(),reserved_requests:10,reserved_concurrency:1},authorization:{id:g.authorizationId,principal_id:g.authorization.authorizingPrincipal.userId,proof_id:g.authorization.proofReference,starts_at:g.authorization.startsAt,expires_at:g.authorization.expiresAt,request_limit:10,concurrency_limit:1,duration_seconds:60},deployment:{target_url:g.deploymentUrl},invariants:[]};}
const key=generateKeyPairSync("ed25519").privateKey;
test("orchestrator recovers, confirms cleanup, releases reservation, then launches",async()=>{
 const c=claim();const events:string[]=[];
 const store={async command(action:string){events.push(action);if(action==="CLEANUP_CLAIM")return {attempt:{id:c.attempt.id,fence:1,state:"FAILED"}};if(action==="CLAIM")return c;}};
 const provider:RunnerProvider={async terminate(){events.push("terminate");},async cleanup(){events.push("cleanup");},async launch(input){events.push("launch");assert.equal(input.attemptId,c.attempt.id);assert.equal(Object.keys(input).length,4);}};
 await new Orchestrator(store,provider,key,{async put(){throw new Error();},async removeAttempt(){events.push("artifacts");}}).tick();
 assert.deepEqual(events,["RECOVER","CLEANUP_CLAIM","terminate","cleanup","artifacts","CLEANUP_DONE","CLAIM","launch"]);
});
test("unconfirmed runner termination never releases capacity or launches replacement",async()=>{
 const c=claim();const actions:string[]=[];const store={async command(a:string){actions.push(a);if(a==="CLEANUP_CLAIM")return {attempt:{id:c.attempt.id,fence:1,state:"FAILED"}};}};
 const provider:RunnerProvider={async terminate(){throw new Error("backend unavailable");},async cleanup(){throw new Error();},async launch(){throw new Error();}};
 await assert.rejects(()=>new Orchestrator(store,provider,key,{async put(){return "";},async removeAttempt(){}}).tick());assert.deepEqual(actions,["RECOVER","CLEANUP_CLAIM"]);
});
test("grant creation binds all persisted identities and rejects changed/private target",()=>{
 const c=claim();const g=grantFromClaim(c);assert.equal(g.commitSha,c.run.commit_sha);assert.equal(g.authorizationId,c.authorization.id);assert.equal(g.limits.spendMicros,0);
 assert.throws(()=>grantFromClaim({...c,deployment:{target_url:"https://127.0.0.1/"}}));assert.throws(()=>grantFromClaim({...c,authorization:{...c.authorization,id:"different"}}));
});
test("orchestrator supports rotating signer without replacing execution grant validation",async()=>{
 const c=claim(),ring=new RunnerKeyRing();ring.rotate("phase10",generateKeyPairSync("ed25519"),0);let launched=false;
 const store={async command(a:string){if(a==="CLAIM")return c;}};
 await new Orchestrator(store,{async launch(input){assert.equal(ring.verify(input.grant).attemptId,c.attempt.id);launched=true;},async terminate(){},async cleanup(){}},ring,{async put(){return"";},async removeAttempt(){}}).tick();assert.equal(launched,true);
});
