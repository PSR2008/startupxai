import { randomUUID } from "node:crypto";
import type { ExecutionGrant } from "@launchgate/contracts";
import { canonical } from "../../services/runner/metadata";
import { validatePlan,type TestPlan } from "../plans";
import { traceSchema,type RawTrace } from "../runner";
import { plans,snapshotSchema,type BillingEvent,type BillingTrace } from "./contracts";
import type { BillingRuntime } from "./fixture";
import { encodeEvent,signEvent,safeMode } from "./provider";

/** Registered operations only. Returns observations; policy/oracle stays outside. */
export async function collectBilling(planInput:TestPlan,g:ExecutionGrant,runtime:BillingRuntime,signal:AbortSignal,consume:()=>Promise<void>,approveNegative:(trace:RawTrace)=>Promise<boolean>,pace:()=>Promise<void>=()=>new Promise(r=>setTimeout(r,500))):Promise<RawTrace>{
 const plan=validatePlan(planInput),config=plan.billing!,started=Date.now();let now=1000;
 const b:BillingTrace={controlBefore:null,controlAfter:null,controlFeature:null,before:null,after:null,stable:null,feature:null,checkpoints:[],events:[],eventsDelivered:0,providerOperations:0,financialSpend:0,reason:"NONE"};
 const t:RawTrace={id:randomUUID(),initialHash:runtime.initialHash,mapping:runtime.mapping,health:false,positive:null,controlBefore:null,controlAfter:null,before:null,after:null,response:null,execution:"SETUP_FAILED",cleanup:false,requests:0,durationMs:0,completedAt:new Date().toISOString(),billing:b};
 const bounded=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(plan.budget.durationMs,g.exp*1000-Date.now())))]);
 const send=async(path:string,body?:unknown,attack=false)=>{
  bounded.throwIfAborted();if(t.requests>=plan.budget.requests)throw new Error("REQUEST_LIMIT");await pace();bounded.throwIfAborted();await consume();t.requests++;
  const r=await fetch(runtime.origin+path,{method:body?"POST":"GET",redirect:"error",signal:AbortSignal.any([bounded,AbortSignal.timeout(1500)]),headers:{"content-type":"application/json","x-launchgate-lab-scope":runtime.scopeKey,"x-launchgate-lab-phase":attack?"adversarial":"control"},...(body?{body:JSON.stringify(body)}:{})});
  const reader=r.body!.getReader();let size=0;const chunks:Uint8Array[]=[];try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>8192){await reader.cancel();throw new Error("BODY_LIMIT");}chunks.push(p.value);}}finally{reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString()||"{}");if(data.reason)throw new Error(data.reason);
  return {status:r.status,data};
 };
 const observe=async(who:string)=>{const r=await send(`/observe/${who}`);if(r.status!==200)throw new Error("OBSERVATION_FAILED");return snapshotSchema.parse(r.data);};
 const feature=async(who:string)=>{const r=await send(`/export/${who}`);if(r.status!==200&&r.status!==403||typeof r.data.allowed!=="boolean")throw new Error("OBSERVATION_FAILED");return r.status===200&&r.data.allowed===true;};
 const order=async(who:"control"|"subject",tier:"BASIC"|"PRO"="BASIC",amount:number=plans[tier].amount,currency="USD")=>{safeMode(config.mode);b.providerOperations++;return send("/order",{account:who,plan:tier,amount,currency},who==="subject");};
 const event=(who:"control"|"subject",extra:Partial<BillingEvent>={}):BillingEvent=>({provider:config.provider,providerAccount:runtime.mapping.identities.provider,mode:config.mode,id:runtime.mapping.resources[`event_${who}`],account:who,orderId:runtime.mapping.resources[`order_${who}`],paymentId:runtime.mapping.resources[`payment_${who}`],subscriptionId:runtime.mapping.resources[`subscription_${who}`],invoiceId:runtime.mapping.resources[`invoice_${who}`],refundId:null,kind:"PAYMENT",state:"CAPTURED",plan:"BASIC",amount:1000,currency:"USD",version:1,at:1000,...extra});
 const deliver=async(e:BillingEvent,signatureKind="valid",concurrent=false)=>{
  safeMode(config.mode);safeMode(e.mode);let raw=encodeEvent(e);let signature=signEvent(config.provider,raw,signatureKind==="secret"?"synthetic-wrong-secret":runtime.secret,now);
  if(signatureKind==="invalid")signature=signature.replace(/[a-f0-9]$/,x=>x==="0"?"1":"0");
  if(signatureKind==="missing")signature="";if(signatureKind==="malformed")signature="bad-signature";if(signatureKind==="modified")raw+=" ";
  b.eventsDelivered+=concurrent?2:1;b.providerOperations+=concurrent?2:1;
  b.events.push({logicalEvent:e.id===runtime.mapping.resources.event_control?"control":e.id===runtime.mapping.resources.event_second?"second":e.id===runtime.mapping.resources.event_third?"third":"subject",provider:e.provider,mode:e.mode,state:e.state,kind:e.kind,amount:e.amount,currency:e.currency,plan:e.plan,version:e.version,at:e.at,deliveries:concurrent?2:1});
  const r=await send(concurrent?"/concurrent":"/webhook",{raw,signature,eventId:e.id},e.account!=="control");t.response={status:r.status,marker:null};return r;
 };
 const clock=async(value:number)=>{await send("/clock",{now:value},true);now=value;};
 const checkpoint=async()=>{b.checkpoints.push({snapshot:await observe("subject"),allowed:await feature("subject")});};
 try{
  safeMode(config.mode);if(g.paymentMode!=="TEST_ONLY"||g.limits.spendMicros!==0)throw new Error("SAFETY_STOP");
  if(config.policy.status!=="CONFIRMED")throw new Error("REQUIRES_CONFIRMATION");
  t.health=(await send("/health")).data.healthy===true;
  b.controlBefore=await observe("control");await order("control");const control=await deliver(event("control"));t.positive={status:control.status,marker:null};
  b.controlAfter=await observe("control");b.controlFeature=await feature("control");
  if(!await approveNegative(t))throw new Error("CONTROL_FAILED");
  b.before=await observe("subject");
  const c=plan.caseId,tier=c==="billing.price_plan"||c==="billing.downgrade"?"PRO":"BASIC";
  const created=await order("subject",tier,c==="billing.price"?1:c==="billing.price_plan"?1000:plans[tier].amount,c==="billing.currency"?"INR":"USD");t.response={status:created.status,marker:null};
  const success=event("subject",{plan:tier,amount:plans[tier].amount});
  const second=(kind:BillingEvent["kind"],extra:Partial<BillingEvent>={})=>event("subject",{id:runtime.mapping.resources.event_second,kind,version:3,...extra});
  if(["billing.price","billing.price_plan","billing.currency"].includes(c)){ /* provider order observed below */ }
  else if(c==="billing.client_plan")await send("/client-plan",{plan:"PRO"},true);
  else if(c.startsWith("billing.signature_"))await deliver(success,c.slice("billing.signature_".length));
  else if(["billing.failed","billing.created","billing.pending","billing.authorized"].includes(c))await deliver({...success,state:c.slice(8).toUpperCase() as BillingEvent["state"]});
  else if(c==="billing.wrong_account")await deliver({...success,paymentId:runtime.mapping.resources.payment_control});
  else if(c==="billing.amount_mismatch")await deliver({...success,amount:1});
  else if(c==="billing.concurrent")await deliver(success,"valid",true);
  else{
   await deliver(success);
   if(c==="billing.duplicate"){await deliver(success);await deliver(success);}
   else if(c==="billing.replay"){
    await clock(1010);await send("/restart",{},true);await deliver(second("NOOP"));await deliver(success);
   }else if(c==="billing.cancel"||c==="billing.order_cancel"){
    await deliver(second("CANCEL"));
    if(c==="billing.order_cancel")await deliver({...success,id:runtime.mapping.resources.event_third,version:2});
    else if(config.policy.cancel==="PERIOD_END"){await clock(1099);await checkpoint();await clock(1100);await checkpoint();await clock(1101);}
   }else if(c==="billing.expiry"){
    await clock(1099);await checkpoint();await clock(1100);await checkpoint();await clock(1101);
   }else if(c==="billing.upgrade"||c==="billing.order_upgrade"){
    await deliver(second("UPGRADE",{plan:"PRO",amount:2500}));
    if(c==="billing.order_upgrade")await deliver({...success,id:runtime.mapping.resources.event_third,version:2});
   }else if(c==="billing.downgrade"){
    await deliver(second("DOWNGRADE",{plan:"BASIC"}));
    if(config.policy.downgrade==="NEXT_PERIOD"){await clock(1099);await checkpoint();await clock(1100);await checkpoint();}
   }else if(c==="billing.refund"||c==="billing.order_refund"){
    const refund=second("REFUND",{state:"REFUNDED",refundId:runtime.mapping.resources.refund_subject});await deliver(refund);
    if(c==="billing.refund")await deliver(refund);else await deliver({...success,id:runtime.mapping.resources.event_third,version:2});
   }
  }
  b.after=await observe("subject");b.feature=await feature("subject");b.stable=await observe("subject");t.execution="COMPLETED";
 }catch(error){
  const reason=(error as Error).message;
  b.reason=reason==="SAFETY_STOP"||reason==="REQUIRES_CONFIRMATION"||reason==="UNKNOWN_PROVIDER_STATE"||reason==="OBSERVATION_FAILED"?reason:(error as Error).name.includes("Timeout")||bounded.aborted?"ADAPTER_TIMEOUT":"ADAPTER_FAILURE";
  t.execution=b.reason==="ADAPTER_TIMEOUT"?"TIMEOUT":b.reason==="OBSERVATION_FAILED"?"UNOBSERVABLE":"SETUP_FAILED";
 }finally{try{await runtime.dispose();t.cleanup=true;}catch{t.cleanup=false;}t.durationMs=Date.now()-started;t.completedAt=new Date().toISOString();}
 const parsed=traceSchema.parse(t);if(Buffer.byteLength(canonical(parsed))>plan.budget.artifactBytes)throw new Error("TRACE_LIMIT");return parsed;
}
