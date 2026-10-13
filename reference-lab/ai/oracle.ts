import type { Attempt } from "@launchgate/contracts";
import { failureSignature } from "@launchgate/verification-core";
import { canonical } from "../../services/runner/metadata";
import type { TestPlan } from "../plans";
import type { RawTrace } from "../runner";
export function aiPositive(p:TestPlan,t:RawTrace){const s=t.ai?.control;return !!(p.ai&&t.health&&t.positive?.status===200&&s?.calls.length===1&&s.calls[0].model==="premium"&&s.calls[0].reservationSequence>0&&s.calls[0].reservationSequence<s.calls[0].invocationSequence&&s.orgUsage===1&&s.costCommitted===6&&s.reserved===0&&s.costReserved===0);}
export function evaluateAi(plan:TestPlan,t:RawTrace):{attempt:Attempt;candidate:boolean}{
 const c=plan.caseId,b=t.ai,s=b?.after,policy=plan.ai!.policy;let calls=0,usage=0,cost=0,rate=0,model="small";
 if(["ai.paid","ai.expensive_paid"].includes(c)){calls=usage=rate=1;cost=6;model="premium";}
 if(["ai.quota","ai.reservation","ai.concurrent","ai.organization","ai.org_concurrent"].includes(c)){calls=usage=rate=5;cost=15;}
 if(["ai.rate","ai.rate_concurrent","ai.distributed","ai.org_cost"].includes(c)){calls=usage=rate=3;cost=9;}
 if(c==="ai.rate_burst"){calls=usage=rate=4;cost=12;}
 if(c==="ai.rate_reset"){calls=usage=4;rate=1;cost=12;}
 if(c==="ai.reset"){calls=6;usage=rate=1;cost=3;}
 if(c==="ai.failure"){calls=rate=1;usage=policy.status==="CONFIRMED"&&policy.failed==="RESERVED_ONLY"?1:0;cost=usage?4:0;}
 const observable=!!(b?.before&&s&&b.stable),stable=observable&&canonical(s)===canonical(b!.stable);
 const values=[!!s&&s.calls.length===calls,!!s&&s.orgUsage===usage&&Object.values(s.usage).reduce((n,v)=>n+v,0)===usage,!!s&&s.reserved===0&&s.costReserved===0&&s.reservations===calls&&s.calls.every(x=>x.reservationSequence>0&&x.reservationSequence<x.invocationSequence),!!s&&s.costCommitted===cost,!!s&&s.calls.every(x=>x.model===model),!!s&&Object.values(s.rate).reduce((n,x)=>n+x.count,0)===rate];
 const controls=[{id:"health",passed:t.health},{id:"positive_control",passed:aiPositive(plan,t)},{id:"observable",passed:observable&&stable},{id:"cleanup",passed:t.cleanup},{id:"confirmed_policy",passed:policy.status==="CONFIRMED"},{id:"zero_spend",passed:plan.ai!.mode==="SYNTHETIC"&&b?.realFinancialSpend===0}];
 const attempt:Attempt={id:t.id,completedAt:t.completedAt,execution:t.execution,preconditions:controls,observations:plan.spec.assertions.map((a,i)=>({id:a.observation,value:values[i]})),assertions:plan.spec.assertions.map((a,i)=>({id:a.id,passed:values[i]})),fixtureStateDigest:t.initialHash,failureSignature:null};
 const candidate=t.execution==="COMPLETED"&&controls.every(x=>x.passed)&&values.some(x=>!x);if(candidate)attempt.failureSignature=failureSignature(plan.spec,attempt);return {attempt,candidate};
}
