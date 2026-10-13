import { test } from "node:test";
import assert from "node:assert/strict";
import { billingTriplets } from "./fixtures/billing-lab";
import { executeCase } from "./fixtures/dynamic-lab";
import { billingPlan } from "./fixtures/billing-lab";
import { startBillingFixture,activeBillingFixtures } from "../reference-lab/billing/fixture";
import { encodeEvent,signEvent } from "../reference-lab/billing/provider";
import { eventSchema } from "../reference-lab/billing/contracts";
billingTriplets(["billing.concurrent"]);
test("barrier-synchronized duplicate delivery repeatedly commits one business effect",async()=>{
 for(let i=0;i<5;i++){const {result}=await executeCase("billing.concurrent","fixed");assert.equal(result.traces[0].billing!.after!.account.effects,1);assert.equal(result.traces[0].billing!.after!.inbox,1);assert.equal(result.evaluation.outcome,"PASS");}
});
test("transaction failure rolls back inbox and entitlement together",async()=>{
 const runtime=await startBillingFixture(billingPlan("billing.success"),"fixed","TRANSACTION_FAILURE");
 const send=async(path:string,body?:unknown)=>fetch(runtime.origin+path,{method:body?"POST":"GET",headers:{"x-launchgate-lab-scope":runtime.scopeKey,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await send("/order",{account:"subject",plan:"BASIC",amount:1000,currency:"USD"});
  const r=runtime.mapping.resources,e=eventSchema.parse({provider:"SYNTHETIC",providerAccount:runtime.mapping.identities.provider,mode:"SYNTHETIC",id:r.event_subject,account:"subject",orderId:r.order_subject,paymentId:r.payment_subject,subscriptionId:r.subscription_subject,invoiceId:r.invoice_subject,refundId:null,kind:"PAYMENT",state:"CAPTURED",plan:"BASIC",amount:1000,currency:"USD",version:1,at:1000});
  const raw=encodeEvent(e);assert.equal((await send("/webhook",{raw,signature:signEvent("SYNTHETIC",raw,runtime.secret,1000),eventId:e.id})).status,503);
  const observation=await (await send("/observe/subject")).json();assert.equal(observation.inbox,0);assert.equal(observation.account.effects,0);assert.equal(observation.account.plan,"FREE");
 }finally{await runtime.dispose();}assert.equal(activeBillingFixtures(),0);
});
