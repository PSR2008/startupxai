import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase,makePlan } from "./fixtures/dynamic-lab";
import { regressionArtifact } from "../reference-lab/evaluation";
import { validatePlan,planHash } from "../reference-lab/plans";
for(const c of ["auth.api","tenant.read","role.viewer_developer"] as const)test(`${c} native regression fails vulnerable, passes fixed, fails reintroduction`,async()=>{
 const plan=makePlan(c);const origin=await executeCase(c,"vulnerable",{plan});const artifact=regressionArtifact(plan,"finding-native",{commitSha:origin.grant.commitSha,deploymentId:origin.grant.deploymentId});
 const restored=validatePlan(JSON.parse(JSON.stringify(artifact.plan)));assert.equal(planHash(restored),artifact.planHash);
 assert.equal(origin.result.evaluation.outcome,"REPRODUCIBLE_FAILURE");assert.equal((await executeCase(c,"fixed",{plan:restored})).result.evaluation.outcome,"PASS");assert.equal((await executeCase(c,"vulnerable",{plan:restored})).result.evaluation.outcome,"REPRODUCIBLE_FAILURE");
});
