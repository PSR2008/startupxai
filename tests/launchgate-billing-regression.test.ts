import { test } from "node:test";
import assert from "node:assert/strict";
import { billingPlan } from "./fixtures/billing-lab";
import { executeCase } from "./fixtures/dynamic-lab";
import { regressionArtifact } from "../reference-lab/evaluation";
for(const id of ["billing.price","billing.failed","billing.authorized","billing.duplicate","billing.cancel"] as const)test(`billing regression ${id}: vulnerable -> fixed -> reintroduced`,async()=>{
 const plan=billingPlan(id);const bad=await executeCase(id,"vulnerable",{plan});const artifact=regressionArtifact(plan,"synthetic-finding",{commitSha:bad.grant.commitSha,deploymentId:bad.grant.deploymentId});
 assert.equal(bad.result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal(artifact.expectedOutcome,"PASS");
 const fixed=await executeCase(id,"fixed",{plan:artifact.plan});assert.equal(fixed.result.evaluation.outcome,"PASS");assert.equal(fixed.result.bundle.planHash,bad.result.bundle.planHash);
 const again=await executeCase(id,"vulnerable",{plan:artifact.plan});assert.equal(again.result.evaluation.outcome,"REPRODUCIBLE_FAILURE");
});
test("reject-all-webhooks fix cannot resolve billing finding",async()=>{const plan=billingPlan("billing.duplicate");await executeCase(plan.caseId,"vulnerable",{plan});const {result}=await executeCase(plan.caseId,"fixed",{plan,billingFault:"REJECT_ALL"});assert.equal(result.evaluation.outcome,"INCONCLUSIVE");});
