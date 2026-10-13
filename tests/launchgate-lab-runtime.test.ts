import { test } from "node:test";
import assert from "node:assert/strict";
import { startFixture,activeFixtures } from "../reference-lab/runtime";
import { compilePlan,defaultCapabilities,labInvariant } from "../reference-lab/plans";
import { executeCase,makePlan,labGrant } from "./fixtures/dynamic-lab";
import { collectTrace } from "../reference-lab/runner";
import { positiveControl } from "../reference-lab/evaluation";
import { TargetClient } from "../services/runner/target";
import { generateKeyPairSync } from "node:crypto";
import { admitLab } from "../reference-lab/host";
import { signGrant } from "../services/runner/grant";
import { planHash } from "../reference-lab/plans";
test("executable lab exposes scoped health and fresh identities with deterministic initial state",async()=>{
 const a=await startFixture("auth.api","fixed","seed"),b=await startFixture("auth.api","fixed","seed");try{
  assert.equal((await fetch(`${a.origin}/health`)).status,403);assert.equal((await fetch(`${a.origin}/health`,{headers:{"x-launchgate-lab-scope":a.scopeKey}})).status,200);
  assert.notEqual(a.mapping.identities.tenant_a_member,b.mapping.identities.tenant_a_member);assert.notEqual(a.tokens.tenant_a_owner,b.tokens.tenant_a_owner);assert.equal(a.initialHash,b.initialHash);
 }finally{await a.dispose();await b.dispose();}assert.equal(activeFixtures(),0);
});
test("compiler refuses model claims, unconfirmed policy, arbitrary operations and altered oracle",()=>{
 const spec=labInvariant("tenant.read");for(const changed of [{...spec,confirmation:{status:"PROPOSED"}},{...spec,provenance:{source:"model_proposal",references:["claim"]}},{...spec,operation:{...spec.operation,kind:"eval"}},{...spec,assertions:[{id:"fake",observation:"status",comparator:"equals",expected:200}]}])assert.throws(()=>compilePlan(changed,"tenant.read","seed",defaultCapabilities("tenant.read")));
 const p=makePlan("tenant.read");assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.spec.assertions));
});
for(const [fault,outcome] of [["SIDE_EFFECT_403","REPRODUCIBLE_FAILURE"],["SANITIZED_200","PASS"],["MASKED_404","PASS"],["ERROR_500","INCONCLUSIVE"],["TIMEOUT","INCONCLUSIVE"],["MISSING_CREDENTIALS","INCONCLUSIVE"],["CLEANUP_FAILURE","INCONCLUSIVE"],["RUNNER_FAILURE","INCONCLUSIVE"]] as const)
 test(`false-positive defense and cleanup: ${fault}`,async()=>{const {result}=await executeCase("tenant.write","fixed",{fault});assert.equal(result.evaluation.outcome,outcome);assert.equal(activeFixtures(),0);if(fault==="CLEANUP_FAILURE")assert.equal(result.traces[0].cleanup,false);});
test("broken positive control stops before adversarial operation",async()=>{
 const {result}=await executeCase("auth.api","fixed",{fault:"ERROR_500"});assert.equal(result.traces[0].response,null);assert.equal(result.evaluation.outcome,"INCONCLUSIVE");
});
test("cancelled attempt disposes runtime and cannot claim a completed observation",async()=>{
 const plan=makePlan("tenant.write"),g=labGrant(plan,"vulnerable"),runtime=await startFixture(plan.caseId,"vulnerable",plan.seed);const abort=new AbortController();let count=0;
 const t=await collectTrace(plan,g,runtime,abort.signal,async()=>{if(++count===3)abort.abort();},async t=>positiveControl(plan,t),async()=>{});assert.notEqual(t.execution,"COMPLETED");assert.equal(t.cleanup,true);assert.equal(activeFixtures(),0);
});
test("runner collection exception disposes synthetic state and records runner error",async()=>{
 const plan=makePlan("tenant.write"),g=labGrant(plan,"vulnerable"),runtime=await startFixture(plan.caseId,"vulnerable",plan.seed);
 const t=await collectTrace(plan,g,runtime,new AbortController().signal,async()=>{throw new Error("COLLECTOR_FAILED");},async t=>positiveControl(plan,t),async()=>{});
 assert.equal(t.execution,"RUNNER_ERROR");assert.equal(t.cleanup,true);assert.equal(activeFixtures(),0);
});
test("production target transport refuses lab grants; no localhost policy relaxation",async()=>{
 const g=labGrant(makePlan("tenant.read"),"fixed");await assert.rejects(()=>new TargetClient(g,async()=>{}).get(g.deploymentUrl,new AbortController().signal),/REFERENCE_LAB_TRANSPORT_REQUIRED/);
});
test("lab admission rejects unsigned/model claims and expired grants before storage",async()=>{
 const keys=generateKeyPairSync("ed25519"),plan=makePlan("tenant.read"),g=labGrant(plan,"fixed");let touched=false;
 const store={async command(){touched=true;return {};}};const artifacts={async put(){touched=true;return "forged";},async removeAttempt(){}};
 await assert.rejects(()=>admitLab("model-claim",keys.publicKey,[],store,artifacts));
 await assert.rejects(()=>admitLab(signGrant({...g,iat:g.iat-1000,exp:g.exp-1000},keys.privateKey),keys.publicKey,[],store,artifacts));assert.equal(touched,false);
});
test("lab admission checks current authority and immutable plan/source scope",async()=>{
 const keys=generateKeyPairSync("ed25519"),plan=makePlan("tenant.read"),g=labGrant(plan,"fixed");let stored=false;
 const artifacts={async put(){stored=true;return "forged";},async removeAttempt(){}};
 await assert.rejects(()=>admitLab(signGrant(g,keys.privateKey),keys.publicKey,[],{async command(){throw new Error("REVOKED");}},artifacts),/REVOKED/);
 const store={async command(action:string){return action==="LAB_CONTEXT"?{case:{plan,plan_hash:planHash(plan)},template:{variant:"fixed",source_digest:g.referenceLab!.sourceDigest}}:{};}};
 await assert.rejects(()=>admitLab(signGrant({...g,referenceLab:{...g.referenceLab!,seed:"changed"}},keys.privateKey),keys.publicKey,[],store,artifacts),/LAB_SCOPE/);assert.equal(stored,false);
});
