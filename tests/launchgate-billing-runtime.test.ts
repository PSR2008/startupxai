import { test } from "node:test";
import assert from "node:assert/strict";
import { billingPlan,billingTriplets,configured } from "./fixtures/billing-lab";
import { executeCase,labGrant } from "./fixtures/dynamic-lab";
import { collectBilling } from "../reference-lab/billing/collector";
import { activeBillingFixtures,startBillingFixture } from "../reference-lab/billing/fixture";
import { positiveControl } from "../reference-lab/evaluation";
import { compilePlan,defaultCapabilities,labInvariant } from "../reference-lab/plans";
billingTriplets(["billing.wrong_account","billing.amount_mismatch"]);
for(const fault of ["REJECT_ALL","ADAPTER_TIMEOUT","UNKNOWN_STATE","OBSERVATION_FAILED","CLEANUP_FAILURE","TRANSACTION_FAILURE"] as const)test(`billing false-positive defense ${fault}`,async()=>{
 const {result}=await executeCase(fault==="TRANSACTION_FAILURE"?"billing.success":"billing.signature_invalid","fixed",{billingFault:fault});assert.equal(result.evaluation.outcome,"INCONCLUSIVE");assert.equal(activeBillingFixtures(),0);
});
test("HTTP 500 after entitlement mutation is reproduced failure",async()=>{const {result}=await executeCase("billing.duplicate","vulnerable",{billingFault:"MUTATE_500"});assert.equal(result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(result.traces[0].response!.status,500);});
for(const provider of ["SYNTHETIC","STRIPE","RAZORPAY"] as const)test(`${provider} LIVE mode stops before provider operations even on authorized lab host`,async()=>{
 const plan=billingPlan("billing.success",{...configured(provider),mode:"LIVE"});const {result,requests}=await executeCase(plan.caseId,"fixed",{plan});assert.equal(result.evaluation.outcome,"INCONCLUSIVE");assert.equal(result.traces[0].billing!.reason,"SAFETY_STOP");assert.equal(requests,0);assert.equal(result.traces[0].billing!.providerOperations,0);
});
for(const id of ["billing.cancel","billing.downgrade","billing.refund"] as const)test(`${id} unknown policy requires confirmation without provider effects`,async()=>{
 const plan=billingPlan(id,{...configured(),policy:{status:"UNKNOWN"}});const {result}=await executeCase(id,"vulnerable",{plan});assert.equal(result.evaluation.outcome,"INCONCLUSIVE");assert.equal(result.traces[0].billing!.reason,"REQUIRES_CONFIRMATION");assert.equal(result.requests,0);
});
test("billing cancellation cleans runtime and records no conclusive outcome",async()=>{
 const plan=billingPlan("billing.duplicate"),g=labGrant(plan,"fixed"),runtime=await startBillingFixture(plan,"fixed"),abort=new AbortController();let n=0;
 const t=await collectBilling(plan,g,runtime,abort.signal,async()=>{if(++n===3)abort.abort();},async t=>positiveControl(plan,t),async()=>{});assert.notEqual(t.execution,"COMPLETED");assert.equal(t.cleanup,true);assert.equal(activeBillingFixtures(),0);
});
test("model billing claims cannot compile an execution plan or finding",()=>{
 const s=labInvariant("billing.duplicate");assert.throws(()=>compilePlan({...s,provenance:{source:"model_proposal",references:["webhook insecure"]}},"billing.duplicate","seed",defaultCapabilities("billing.duplicate")));
});
