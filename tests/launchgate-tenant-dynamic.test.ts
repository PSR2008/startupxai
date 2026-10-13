import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase } from "./fixtures/dynamic-lab";
for(const caseId of ["tenant.read","tenant.write","tenant.delete"] as const)for(const [variant,outcome] of [["vulnerable","REPRODUCIBLE_FAILURE"],["fixed","PASS"],["inconclusive","INCONCLUSIVE"]] as const)
 test(`${caseId} identifier substitution ${variant} => ${outcome}`,async()=>{const {result}=await executeCase(caseId,variant);assert.equal(result.evaluation.outcome,outcome);if(variant==="fixed")assert.equal(result.evidence.original.observations.find(o=>o.id==="state_unchanged")?.value,true);});
