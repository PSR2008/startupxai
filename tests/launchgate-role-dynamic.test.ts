import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase } from "./fixtures/dynamic-lab";
for(const caseId of ["role.member_owner","role.member_admin","role.viewer_developer","role.developer_owner"] as const)for(const [variant,outcome] of [["vulnerable","REPRODUCIBLE_FAILURE"],["fixed","PASS"],["inconclusive","INCONCLUSIVE"]] as const)
 test(`${caseId} direct role mutation ${variant} => ${outcome}`,async()=>{const {result}=await executeCase(caseId,variant);assert.equal(result.evaluation.outcome,outcome);if(variant==="vulnerable")assert.notEqual(result.traces[0].before?.role,result.traces[0].after?.role);});
