import { compilePlan, defaultCapabilities, labInvariant, planHash } from "../../reference-lab/plans";
import type { ReleasePolicy } from "../releases/contracts";
export function productLabCatalog(input: { invariant_id: string; adjacent_id: string; policy_id: string }) {
 const plans = ([ ["tenant.read", input.invariant_id], ["tenant.write", input.adjacent_id] ] as const).map(([caseId,id])=>compilePlan({...labInvariant(caseId,id),statement:caseId==="tenant.read"?"Members of one organization must never read another organization's projects.":"Members of one organization must never modify another organization's projects."},caseId,"product-lab-v1",defaultCapabilities(caseId)));
 const policy: ReleasePolicy = { id:input.policy_id,version:1,blockingSeverities:["critical","high"],requiredFamilies:["tenant_isolation"],requirements:plans.map(plan=>({invariant:plan.spec,required:true,baseline:true,kind:"REGRESSION",family:plan.family,runnerVersion:"lg-runner-1",testVersion:"lab-test-1",fixtureVersion:1,planHash:planHash(plan),estimatedCost:1,applicabilityProof:null})),freshnessSeconds:3600,environments:["SANDBOX"],minimumCoverage:1,requiredInconclusive:"NON_APPROVAL",allowExceptions:false,maximumExceptionSeconds:3600 };
 return {plans,policy};
}
