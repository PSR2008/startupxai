import type { Attempt } from "@launchgate/contracts";
import { failureSignature } from "@launchgate/verification-core";
import type { TestPlan } from "../plans";
import type { RawTrace } from "../runner";
export function browserPositive(_p:TestPlan,t:RawTrace){return !!(t.health&&t.browser?.control.length===3&&t.browser.control.every(Boolean));}
export function evaluateBrowser(plan:TestPlan,t:RawTrace):{attempt:Attempt;candidate:boolean}{
 const b=t.browser,s=b?.state,c=plan.caseId;const expected=plan.journey!.steps.filter(x=>x.kind.startsWith("ASSERT_")).length;
 const checks=!!b&&b.checks.length===expected&&b.checks.every(Boolean);let business=!!s&&s.providerCalls===0;
 if(c==="browser.crud")business&&=s?.record==="updated"&&s.successes===2;
 if(["browser.missing","browser.server_error","browser.quota"].includes(c))business&&=s?.successes===0;
 if(["browser.paid","browser.entitlement"].includes(c))business&&=s?.paidAccess===false;
 if(["browser.protected","browser.invalid","browser.expired","browser.logout","browser.release"].includes(c))business&&=s?.authenticated===false;
 const preconditions=[{id:"health",passed:t.health},{id:"positive_control",passed:browserPositive(plan,t)},{id:"observable",passed:!!s},{id:"cleanup",passed:t.cleanup}];
 const attempt:Attempt={id:t.id,completedAt:t.completedAt,execution:t.execution,preconditions,observations:[{id:"journey_assertions_match",value:checks},{id:"journey_business_state_matches",value:business}],assertions:[{id:"journey",passed:checks},{id:"business",passed:business}],fixtureStateDigest:t.initialHash,failureSignature:null};
 const candidate=t.execution==="COMPLETED"&&preconditions.every(x=>x.passed)&&(!checks||!business);if(candidate)attempt.failureSignature=failureSignature(plan.spec,attempt);return {attempt,candidate};
}
