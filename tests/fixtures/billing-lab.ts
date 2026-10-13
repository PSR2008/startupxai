import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { compilePlan,defaultCapabilities,labInvariant } from "../../reference-lab/plans";
import { defaultBillingConfig,type BillingConfig,type BillingCase,type Provider } from "../../reference-lab/billing/contracts";
import { activeBillingFixtures } from "../../reference-lab/billing/fixture";
import { executeCase } from "./dynamic-lab";
export const billingPlan=(id:BillingCase,config:BillingConfig=defaultBillingConfig)=>compilePlan(labInvariant(id,randomUUID()),id,"billing-seed",defaultCapabilities(id),config);
export const configured=(provider:Provider="SYNTHETIC",policy:Partial<Extract<BillingConfig["policy"],{status:"CONFIRMED"}>>={}):BillingConfig=>({provider,mode:provider==="SYNTHETIC"?"SYNTHETIC":"TEST",policy:{...defaultBillingConfig.policy,...policy} as BillingConfig["policy"]});
export function billingTriplets(ids:BillingCase[],config=defaultBillingConfig,label=""){
 for(const id of ids)for(const [variant,outcome] of [["vulnerable","REPRODUCIBLE_FAILURE"],["fixed","PASS"],["inconclusive","INCONCLUSIVE"]] as const)test(`${label}${id} ${variant}: ${outcome}`,async()=>{
  const {result,requests}=await executeCase(id,variant,{plan:billingPlan(id,config)});
  assert.equal(result.evaluation.outcome,outcome,JSON.stringify(result.evidence.original));
  assert.ok(result.traces.every(t=>t.billing?.financialSpend===0&&t.cleanup));assert.equal(requests,result.requests);assert.ok(requests<=64);
  if(outcome==="REPRODUCIBLE_FAILURE"){assert.equal(result.traces.length,2);assert.notDeepEqual(result.traces[0].mapping,result.traces[1].mapping);assert.equal(result.traces[0].initialHash,result.traces[1].initialHash);}
  assert.equal(activeBillingFixtures(),0);
 });
}
