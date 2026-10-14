// Trusted control-plane deterministic evaluation; the runner supplies observations.
import { evidenceSchema,type Attempt,type Evidence,type ExecutionGrant } from "@launchgate/contracts";
import { evaluateOutcome,failureSignature,planDigest } from "@launchgate/verification-core";
import { canonical,digest } from "../services/runner/metadata";
import { validatePlan,planHash,type TestPlan } from "./plans";
import { traceSchema,type RawTrace } from "./runner";
import { billingPositive,evaluateBillingTrace } from "./billing/oracle";
import { failureType,isBilling } from "./billing/contracts";
import { aiPositive,evaluateAi } from "./ai/oracle";
import { browserPositive,evaluateBrowser } from "./browser/oracle";

export function positiveControl(plan:TestPlan,t:RawTrace):boolean {
 if(plan.ai)return aiPositive(plan,t);
 if(plan.journey)return browserPositive(plan,t);
 if(plan.billing)return billingPositive(plan,t);
 if(!t.health||!t.positive||t.positive.status!==200||!t.controlBefore?.exists||!t.controlAfter)return false;
 if(plan.caseId==="auth.action")return t.positive.marker==="PRIVATE_B"&&t.controlAfter.exists&&t.controlAfter.value===t.controlBefore.value+1;
 if(plan.family==="auth_session_boundaries"||plan.caseId==="tenant.read")return t.positive.marker==="PRIVATE_B"&&t.controlAfter.exists;
 if(plan.caseId==="tenant.write")return t.controlBefore.value===7&&t.controlAfter.value===8;
 if(plan.caseId==="tenant.delete")return !t.controlAfter.exists;
 const expected=plan.caseId==="role.member_admin"?"ADMIN":plan.caseId==="role.viewer_developer"?"DEVELOPER":"OWNER";
 return t.controlBefore.role!==expected&&t.controlAfter.role===expected;
}
export function evaluateTrace(planInput:TestPlan,input:unknown):{attempt:Attempt;candidate:boolean} {
 const plan=validatePlan(planInput),t=traceSchema.parse(input);
 if(plan.ai)return evaluateAi(plan,t);
 if(plan.journey)return evaluateBrowser(plan,t);
 if(plan.billing)return evaluateBillingTrace(plan,t);
 const observable=!!t.before&&!!t.after&&!!t.response;
 const visible=plan.family!=="privilege_escalation"&&t.response?.marker==="PRIVATE_B";
 const unchanged=observable&&canonical(t.before)===canonical(t.after);
 const execution=t.execution==="COMPLETED"&&t.response&&t.response.status>=500?"TARGET_UNAVAILABLE":t.execution;
 const attempt:Attempt={id:t.id,completedAt:t.completedAt,execution,preconditions:[{id:"health",passed:t.health},{id:"positive_control",passed:positiveControl(plan,t)},{id:"observable",passed:observable},{id:"cleanup",passed:t.cleanup}],
  observations:[{id:"target_visible",value:visible},{id:"state_unchanged",value:unchanged},{id:"http_status",value:t.response?.status??0}],
  assertions:[{id:"not_visible",passed:!visible},{id:"no_side_effect",passed:unchanged}],fixtureStateDigest:t.initialHash,failureSignature:null};
 const candidate=execution==="COMPLETED"&&attempt.preconditions.every(p=>p.passed)&&attempt.assertions.some(a=>!a.passed);
 if(candidate)attempt.failureSignature=failureSignature(plan.spec,attempt);
 return {attempt,candidate};
}
export function evaluateLab(planInput:TestPlan,g:ExecutionGrant,tracesInput:unknown[],sourceDigest:string) {
 const plan=validatePlan(planInput);if(tracesInput.length<1||tracesInput.length>2)throw new Error("TRACE_SEQUENCE");
 const traces=tracesInput.map(t=>traceSchema.parse(t));const original=evaluateTrace(plan,traces[0]);
 if(plan.ai&&["providerOperations","tokenUnits","syntheticCost"].some(k=>traces.reduce((n,t)=>n+(t.ai?.[k as "providerOperations"|"tokenUnits"|"syntheticCost"]??0),0)>(plan.budget[k as "providerOperations"|"tokenUnits"|"syntheticCost"]??0)))throw new Error("AI_BUDGET");
 if(plan.journey&&traces.reduce((n,t)=>n+(t.browser?.actions??0),0)>plan.budget.browserActions!)throw new Error("BROWSER_BUDGET");
 const second=traces[1]?evaluateTrace(plan,traces[1]):null;
 if(second&&original.candidate&&second.candidate&&(plan.ai||plan.journey)){
  const logical=(t:RawTrace)=>t.ai?.after?{...t.ai.after,calls:t.ai.after.calls.map(({id: _id,...call})=>{void _id;return call;})}:t.browser?{checks:t.browser.checks,state:t.browser.state}:null;
  if(canonical(logical(traces[0]))!==canonical(logical(traces[1])))second.attempt.execution="UNOBSERVABLE";
 }
 if(!original.candidate&&second)throw new Error("UNREQUESTED_REPRODUCTION");
 if(traces.reduce((n,t)=>n+t.requests,0)>Math.min(plan.budget.requests,g.limits.requests)||traces.some(t=>Date.parse(t.completedAt)<g.iat*1000||Date.parse(t.completedAt)>g.exp*1000))throw new Error("ATTEMPT_BUDGET_OR_TIME");
 if(plan.billing&&(traces.reduce((n,t)=>n+(t.billing?.eventsDelivered??0),0)>plan.budget.events!||traces.reduce((n,t)=>n+(t.billing?.providerOperations??0),0)>plan.budget.providerOperations!))throw new Error("PROVIDER_BUDGET");
 const scope={organizationId:g.organizationId,projectId:g.projectId,commitSha:g.commitSha,deploymentId:g.deploymentId,policyId:g.releasePolicy?.policyId??"reference-lab-policy",policyVersion:g.releasePolicy?.policyVersion??1,evidenceScope:"REFERENCE_LAB",purpose:"REFERENCE_LAB" as const,invariantId:plan.spec.id,invariantVersion:plan.spec.version};
 const evidence:Evidence=evidenceSchema.parse({schemaVersion:1,runId:g.runId,scope,source:"DETERMINISTIC_EXECUTION",runner:{...g.runner,sourceDigest},fixture:{seed:plan.seed,logicalIdentities:plan.spec.actors.map(a=>a.fixtureRef)},
  planDigest:planDigest(plan.spec),original:original.attempt,reproduction:second?{status:"REPRODUCED",scope,planDigest:planDigest(plan.spec),fixtureSeed:plan.seed,attempt:second.attempt}:{status:original.candidate?"UNAVAILABLE":"NOT_ATTEMPTED"},
  artifacts:[{id:g.attemptId,hash:digest(canonical(traces)),classification:"INTERNAL",redaction:"NO_SENSITIVE_DATA"}],createdAt:traces.at(-1)!.completedAt});
 const evaluation=evaluateOutcome(plan.spec,evidence,{kind:"REFERENCE_LAB"});
 const signature=digest(canonical({project:g.projectId,invariant:plan.spec.id,version:plan.spec.version,operation:plan.spec.operation.kind,registeredCase:plan.caseId,resourceType:plan.resourceType,oracle:original.attempt.failureSignature,...(plan.ai?{aiScope:plan.ai}:{}),...(plan.billing?{billingScope:plan.billing}:{})}));
 const bundle={schemaVersion:1,runId:g.runId,organizationId:g.organizationId,projectId:g.projectId,invariantId:plan.spec.id,invariantVersion:plan.spec.version,
  deploymentId:g.deploymentId,commitSha:g.commitSha,authorizationId:g.authorizationId,authorizationVersion:g.authorizationVersion,attemptId:g.attemptId,fence:g.fence,
  family:plan.family,fixtureVersion:1,seed:plan.seed,plan,planHash:planHash(plan),sourceDigest,logicalBindings:{actor:plan.logicalActor,resource:plan.logicalResource},
  safeRequest:{registeredCase:plan.caseId,operation:plan.spec.operation.kind,actor:plan.logicalActor,resource:plan.logicalResource},assertions:plan.spec.assertions,
  ...(isBilling(plan.caseId)?{failureType:failureType(plan.caseId),providerContract:"SYNTHETIC_CONTRACT",billingPolicy:plan.billing!.policy}:{}),
  attempts:traces.map(t=>({id:t.id,beforeHash:digest(canonical(t.ai?.before??t.billing?.before??t.before)),afterHash:digest(canonical(t.browser?.state??t.ai?.after??t.billing?.after??t.after)),observationHash:digest(canonical(t)),requests:t.requests,durationMs:t.durationMs,cleanup:t.cleanup,...(t.billing?{eventsDelivered:t.billing.eventsDelivered,providerOperations:t.billing.providerOperations,financialSpend:t.billing.financialSpend,logicalTime:t.billing.after?.now??null,reason:t.billing.reason}:{} )})),
  ...(plan.ai?{aiPolicy:plan.ai.policy,providerContract:plan.ai.provider}:{}),...(plan.journey?{journey:plan.journey}:{}),
  concurrency:plan.budget.concurrency,reproductionCount:second?1:0,reproductionStatus:evaluation.outcome==="REPRODUCIBLE_FAILURE"?"REPRODUCED":original.candidate?"INCONCLUSIVE":"NOT_REQUIRED",evidenceDigest:digest(canonical(evidence))};
 return {evaluation,evidence,bundle,signature,traces,candidate:original.candidate,requests:traces.reduce((n,t)=>n+t.requests,0)};
}
export function regressionArtifact(plan:TestPlan,findingId:string,origin:{commitSha:string;deploymentId:string}) {
 return {version:1,originatingFinding:findingId,invariantId:plan.spec.id,invariantVersion:plan.spec.version,planHash:planHash(plan),plan,
  applicability:{family:plan.family,fixtureVersion:1,origin},expectedOutcome:"PASS" as const,oracle:plan.spec.assertions};
}
