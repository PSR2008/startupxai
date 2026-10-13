import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase,makePlan } from "./fixtures/dynamic-lab";
import { evaluateLab } from "../reference-lab/evaluation";
test("same logical violation reproduces across fresh IDs/sessions",async()=>{
 const {result}=await executeCase("tenant.write","vulnerable");assert.equal(result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(result.traces.length,2);
 assert.notDeepEqual(result.traces[0].mapping,result.traces[1].mapping);assert.equal(result.traces[0].initialHash,result.traces[1].initialHash);assert.equal(result.bundle.reproductionCount,1);
});
for(const [name,options] of [["second pass",{reproductionVariant:"fixed"}],["infrastructure error",{reproductionFault:"ERROR_500"}],["different oracle",{reproductionFault:"SIDE_EFFECT_403"}]] as const)
 test(`candidate plus ${name} stays inconclusive`,async()=>{const {result}=await executeCase("tenant.write","vulnerable",options);assert.equal(result.evaluation.outcome,"INCONCLUSIVE");assert.equal(result.candidate,true);});
test("single candidate cannot become a reproducible failure",async()=>{
 const {result,plan,grant}=await executeCase("tenant.read","vulnerable");assert.equal(evaluateLab(plan,grant,[result.traces[0]],grant.referenceLab!.sourceDigest).evaluation.outcome,"INCONCLUSIVE");
});
test("reproduction requests are charged to the same grant and manifest is secret free",async()=>{
 const {result,requests}=await executeCase("role.member_admin","vulnerable");assert.equal(requests,result.traces.reduce((n,t)=>n+t.requests,0));assert.ok(requests<=32);assert.ok(result.traces.every(t=>t.durationMs<=60000&&t.cleanup));
 assert.doesNotMatch(JSON.stringify(result.bundle),/Bearer |x-launchgate-lab-scope|access_token|password/);
});
test("stable finding signature excludes ephemeral IDs and run identity",async()=>{
 const plan=makePlan("tenant.read"),a=await executeCase("tenant.read","vulnerable",{plan}),b=await executeCase("tenant.read","vulnerable",{plan});
 // Project identity is deliberately part of deduplication.
 b.grant.projectId=a.grant.projectId;const recalculated=evaluateLab(plan,b.grant,b.result.traces,b.grant.referenceLab!.sourceDigest);assert.equal(a.result.signature,recalculated.signature);
});
