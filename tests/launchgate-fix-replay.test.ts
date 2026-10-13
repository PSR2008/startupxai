import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase,makePlan } from "./fixtures/dynamic-lab";
import { planHash } from "../reference-lab/plans";
for(const c of ["auth.api","tenant.write","role.member_owner"] as const)test(`exact ${c} fix replay preserves original oracle and positive controls`,async()=>{
 const plan=makePlan(c),bad=await executeCase(c,"vulnerable",{plan}),fixed=await executeCase(c,"fixed",{plan});assert.equal(bad.result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(fixed.result.evaluation.outcome,"PASS");assert.equal(planHash(bad.plan),planHash(fixed.plan));assert.ok(fixed.result.evidence.original.preconditions.every(p=>p.passed));
});
test("feature-breaking fix cannot resolve the finding",async()=>{const plan=makePlan("tenant.read");await executeCase("tenant.read","vulnerable",{plan});const fixed=await executeCase("tenant.read","fixed",{plan,fault:"ERROR_500"});assert.equal(fixed.result.evaluation.outcome,"INCONCLUSIVE");});
test("action fix returning a marker but disabling the authorized side effect cannot pass",async()=>{
 const fixed=await executeCase("auth.action","fixed",{fault:"ACTION_DISABLED"});assert.equal(fixed.result.evaluation.outcome,"INCONCLUSIVE");assert.equal(fixed.result.traces[0].response,null);
});
