import { createHmac,timingSafeEqual } from "node:crypto";
import { eventSchema,type BillingEvent,type Provider } from "./contracts";

export class SafetyStop extends Error {constructor(){super("SAFETY_STOP");}}
export function safeMode(mode:string){if(mode!=="TEST"&&mode!=="SYNTHETIC")throw new SafetyStop();}
export function eventKey(event:BillingEvent){return JSON.stringify([event.provider,event.providerAccount,event.mode,event.id]);}
const mac=(secret:string,value:string)=>createHmac("sha256",secret).update(value).digest("hex");
const equal=(a:string,b:string)=>/^[a-f0-9]{64}$/.test(a)&&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
// Narrow synthetic envelopes using provider-like signature formats. No SDK/API calls.
export function encodeEvent(event:BillingEvent):string {
 const e=eventSchema.parse(event);
 const metadata={account:e.account,plan:e.plan,version:e.version,kind:e.kind,subscriptionId:e.subscriptionId,invoiceId:e.invoiceId,refundId:e.refundId};
 if(e.provider==="STRIPE")return JSON.stringify({id:e.id,type:e.kind==="PAYMENT"?`payment_intent.${stripeStatus[e.state]}`:stripeKinds[e.kind],livemode:e.mode==="LIVE",account:e.providerAccount,created:e.at,data:{object:{id:e.paymentId,order:e.orderId,amount:e.amount,amount_received:e.state==="CAPTURED"?e.amount:0,currency:e.currency.toLowerCase(),status:stripeStatus[e.state],metadata}}});
 if(e.provider==="RAZORPAY")return JSON.stringify({event:e.kind==="PAYMENT"?`payment.${e.state.toLowerCase()}`:razorpayKinds[e.kind],account_id:e.providerAccount,mode:e.mode,created_at:e.at,payload:{payment:{entity:{id:e.paymentId,order_id:e.orderId,amount:e.amount,currency:e.currency,status:e.state.toLowerCase(),captured:e.state==="CAPTURED",notes:metadata}}}});
 return JSON.stringify(e);
}
export function normalizeEvent(provider:Provider,raw:string,eventId?:string):BillingEvent {
 if(Buffer.byteLength(raw)>8192)throw new Error("PROVIDER_PAYLOAD_LIMIT");
 const p=JSON.parse(raw);let candidate:unknown=p;
 if(provider==="STRIPE"){
  if(typeof p.livemode!=="boolean")throw new Error("UNKNOWN_PROVIDER_STATE");safeMode(p.livemode?"LIVE":"TEST");
  const o=p.data?.object,m=o?.metadata,state=Object.entries(stripeStatus).find(([,status])=>status===o?.status)?.[0];
  if(!state||p.type!==(m?.kind==="PAYMENT"?`payment_intent.${o.status}`:stripeKinds[m?.kind as keyof typeof stripeKinds]))throw new Error("UNKNOWN_PROVIDER_STATE");
  candidate={provider,id:p.id,providerAccount:p.account,mode:"TEST",at:p.created,paymentId:o.id,orderId:o.order,amount:state==="CAPTURED"?o.amount_received:o.amount,currency:typeof o.currency==="string"?o.currency.toUpperCase():null,state,...bindings(m)};
 }else if(provider==="RAZORPAY"){
  safeMode(p.mode);const o=p.payload?.payment?.entity,m=o?.notes;
  if(typeof o?.captured!=="boolean"||o.captured!==(o.status==="captured")||p.event!==(m?.kind==="PAYMENT"?`payment.${o.status}`:razorpayKinds[m?.kind as keyof typeof razorpayKinds]))throw new Error("UNKNOWN_PROVIDER_STATE");
  candidate={provider,id:eventId,providerAccount:p.account_id,mode:p.mode,at:p.created_at,paymentId:o.id,orderId:o.order_id,amount:o.amount,currency:o.currency,state:typeof o.status==="string"?o.status.toUpperCase():null,...bindings(m)};
 }
 const result=eventSchema.safeParse(candidate);if(!result.success||result.data.provider!==provider)throw new Error("UNKNOWN_PROVIDER_STATE");
 safeMode(result.data.mode);return result.data;
}
const stripeStatus={CREATED:"created",PENDING:"processing",AUTHORIZED:"requires_capture",CAPTURED:"succeeded",FAILED:"payment_failed",REFUNDED:"refunded"} as const;
const stripeKinds={CANCEL:"customer.subscription.deleted",UPGRADE:"customer.subscription.updated",DOWNGRADE:"customer.subscription.updated",REFUND:"charge.refunded",NOOP:"fixture.noop"} as const;
const razorpayKinds={CANCEL:"subscription.cancelled",UPGRADE:"subscription.updated",DOWNGRADE:"subscription.updated",REFUND:"refund.processed",NOOP:"fixture.noop"} as const;
function bindings(m:Record<string,unknown>){return {account:m?.account,plan:m?.plan,version:m?.version,kind:m?.kind,subscriptionId:m?.subscriptionId,invoiceId:m?.invoiceId,refundId:m?.refundId};}
export function signEvent(provider:Provider,raw:string,secret:string,now:number):string {
 return provider==="STRIPE"?`t=${now},v1=${mac(secret,`${now}.${raw}`)}`:mac(secret,raw);
}
export function verifyEvent(provider:Provider,raw:string,signature:string,secret:string,now:number):boolean {
 if(!secret||signature.length>200||Buffer.byteLength(raw)>8192)return false;
 if(provider!=="STRIPE")return equal(signature,mac(secret,raw));
 const match=/^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(signature);
 return !!match&&Math.abs(now-Number(match[1]))<=300&&equal(match[2],mac(secret,`${match[1]}.${raw}`));
}
