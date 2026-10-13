import { test } from "node:test";
import assert from "node:assert/strict";
import { executeCase } from "./fixtures/dynamic-lab";
import { cases } from "../reference-lab/plans";
for(const caseId of cases.filter(c=>c.startsWith("auth.")))for(const [variant,outcome] of [["vulnerable","REPRODUCIBLE_FAILURE"],["fixed","PASS"],["inconclusive","INCONCLUSIVE"]] as const)
 test(`${caseId} ${variant} => ${outcome}`,async()=>{const {result}=await executeCase(caseId,variant);assert.equal(result.evaluation.outcome,outcome);if(outcome!=="INCONCLUSIVE")assert.ok(result.evidence.original.preconditions.every(p=>p.passed));});
