import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase } from "./fixtures/dynamic-lab";
import { billingPlan,configured } from "./fixtures/billing-lab";
for(const [pattern,id] of [["payment replay refreshes expiry","billing.replay"],["order/signature without captured state grants paid","billing.authorized"],["select-then-write races duplicate business effects","billing.concurrent"]] as const)test(`StartupX isolated equivalent: ${pattern}`,async()=>{
 const plan=billingPlan(id,configured("RAZORPAY"));const bad=await executeCase(id,"vulnerable",{plan}),fixed=await executeCase(id,"fixed",{plan});assert.equal(bad.result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(fixed.result.evaluation.outcome,"PASS");
});
