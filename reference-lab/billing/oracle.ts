import type { Attempt } from "@launchgate/contracts";
import { failureSignature } from "@launchgate/verification-core";
import { canonical } from "../../services/runner/metadata";
import type { TestPlan } from "../plans";
import type { RawTrace } from "../runner";
import { plans,type AccountState } from "./contracts";

export function billingPositive(plan:TestPlan,t:RawTrace):boolean{
 const b=t.billing,a=b?.controlAfter?.account;
 return !!(plan.billing&&b?.controlBefore&&b.controlBefore.account.plan==="FREE"&&b.controlBefore.account.effects===0&&t.health&&t.positive?.status===200&&a?.plan==="BASIC"&&a.payment==="CAPTURED"&&a.effects===1&&a.credits===100&&a.order?.amount===1000&&a.order.currency==="USD"&&a.order.account==="control"&&a.start===1000&&a.end===1100&&b.controlFeature);
}
export function evaluateBillingTrace(plan:TestPlan,t:RawTrace):{attempt:Attempt;candidate:boolean}{
 const b=t.billing,config=plan.billing!,c=plan.caseId,policy=config.policy.status==="CONFIRMED"?config.policy:null;
 let expectedPlan:AccountState["plan"]="FREE",effects=0,subscription:AccountState["subscription"]="FREE",payment:AccountState["payment"]="CREATED",end:number|null=null;
 const paid=()=>{expectedPlan="BASIC";effects=1;subscription="ACTIVE";payment="CAPTURED";end=1100;};
 if(["billing.success","billing.duplicate","billing.concurrent","billing.replay"].includes(c))paid();
 if(c==="billing.failed")payment="FAILED";if(c==="billing.pending")payment="PENDING";if(c==="billing.authorized")payment="AUTHORIZED";
 if(c==="billing.cancel"||c==="billing.order_cancel"){paid();effects=2;expectedPlan="FREE";subscription="CANCELLED";
  if(c==="billing.order_cancel"&&policy?.cancel==="PERIOD_END"){effects=1;expectedPlan="BASIC";subscription="ACTIVE";}}
 if(c==="billing.expiry"){paid();effects=2;expectedPlan="FREE";subscription="EXPIRED";}
 if(c==="billing.upgrade"||c==="billing.order_upgrade"){paid();effects=2;expectedPlan="PRO";}
 if(c==="billing.downgrade"){paid();effects=2;if(policy?.downgrade==="NEXT_PERIOD")end=1200;}
 if(c==="billing.refund"||c==="billing.order_refund"){paid();effects=2;payment="REFUNDED";expectedPlan=policy?.refund==="MANUAL_REVIEW"?"BASIC":"FREE";subscription=policy?.refund==="MANUAL_REVIEW"?"REFUND_REVIEW":"CANCELLED";}
 const a=b?.after?.account,tier=c==="billing.price_plan"||c==="billing.downgrade"?"PRO":"BASIC";
 const observable=!!(b?.before&&b.after&&b.stable&&b.feature!==null);
 let satisfied=!!(a&&a.order&&a.order.plan===tier&&a.order.amount===plans[tier].amount&&a.order.currency==="USD"&&a.order.account==="subject"&&a.plan===expectedPlan&&a.effects===effects&&a.credits===(expectedPlan==="FREE"?0:plans[expectedPlan].credits)&&a.subscription===subscription&&a.payment===payment&&a.end===end);
 if(b&&["billing.expiry","billing.cancel"].includes(c)&&b.checkpoints.length){
  satisfied&&=b.checkpoints.length===2&&b.checkpoints[0].snapshot.now===1099&&b.checkpoints[0].snapshot.account.plan==="BASIC"&&b.checkpoints[0].allowed&&b.checkpoints[1].snapshot.now===1100&&b.checkpoints[1].snapshot.account.plan==="FREE"&&!b.checkpoints[1].allowed;
 }
 if(c==="billing.downgrade"&&policy?.downgrade==="NEXT_PERIOD")satisfied&&=!!(b?.checkpoints.length===2&&b.checkpoints[0].snapshot.account.plan==="PRO"&&b.checkpoints[0].snapshot.account.pendingPlan==="BASIC"&&b.checkpoints[0].allowed&&b.checkpoints[1].snapshot.account.plan==="BASIC"&&b.checkpoints[1].allowed);
 const controls=[{id:"health",passed:t.health},{id:"positive_control",passed:billingPositive(plan,t)},{id:"observable",passed:observable},{id:"cleanup",passed:t.cleanup},{id:"billing_policy",passed:!!policy},{id:"safe_mode",passed:config.mode!=="LIVE"&&b?.reason!=="SAFETY_STOP"&&b?.financialSpend===0}];
 const observations=[{id:"billing_policy_satisfied",value:satisfied},{id:"paid_access_matches",value:b?.feature===(expectedPlan!=="FREE")},{id:"stable_state",value:observable&&canonical(b!.after)===canonical(b!.stable)}];
 const assertions=plan.spec.assertions.map(s=>({id:s.id,passed:observations.find(o=>o.id===s.observation)?.value===s.expected}));
 // A 500 *after* an observed mutation remains a violation. Unknown state/timeouts
 // never become PASS merely because no response was received.
 const attempt:Attempt={id:t.id,completedAt:t.completedAt,execution:t.execution,preconditions:controls,observations,assertions,fixtureStateDigest:t.initialHash,failureSignature:null};
 const candidate=t.execution==="COMPLETED"&&controls.every(p=>p.passed)&&assertions.some(a=>!a.passed);
 if(candidate)attempt.failureSignature=failureSignature(plan.spec,attempt);
 return {attempt,candidate};
}
