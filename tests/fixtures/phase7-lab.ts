import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { compilePlan,defaultCapabilities,labInvariant,type CaseId } from "../../reference-lab/plans";
import { activeAiFixtures } from "../../reference-lab/ai/fixture";
import { activeBrowserFixtures } from "../../reference-lab/browser/fixture";
import { executeCase } from "./dynamic-lab";
export const phase7Plan=(id:CaseId,config?:unknown)=>compilePlan(labInvariant(id,randomUUID()),id,"phase7-seed",defaultCapabilities(id),config);
export function phase7Triplets(ids:CaseId[]){for(const id of ids)for(const [variant,outcome] of [["vulnerable","REPRODUCIBLE_FAILURE"],["fixed","PASS"],["inconclusive","INCONCLUSIVE"]] as const)test(`${id} ${variant}: ${outcome}`,async()=>{
 const {result,requests}=await executeCase(id,variant);assert.equal(result.evaluation.outcome,outcome,JSON.stringify(result.evidence.original));assert.equal(requests,result.requests);assert.ok(requests<=128);assert.ok(result.traces.every(t=>t.cleanup));
 if(outcome==="REPRODUCIBLE_FAILURE"){assert.equal(result.traces.length,2);assert.equal(result.traces[0].initialHash,result.traces[1].initialHash);assert.notDeepEqual(result.traces[0].mapping,result.traces[1].mapping);}
 assert.equal(activeAiFixtures(),0);assert.equal(activeBrowserFixtures(),0);
});}
