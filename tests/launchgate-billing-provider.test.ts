import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eventSchema,type Provider } from "../reference-lab/billing/contracts";
import { encodeEvent,normalizeEvent,signEvent,verifyEvent,eventKey } from "../reference-lab/billing/provider";
import { billingTriplets,configured } from "./fixtures/billing-lab";
const sample=(provider:Provider)=>eventSchema.parse({provider,providerAccount:randomUUID(),mode:"TEST",id:randomUUID(),account:"subject",orderId:randomUUID(),paymentId:randomUUID(),subscriptionId:randomUUID(),invoiceId:randomUUID(),refundId:null,kind:"PAYMENT",state:"CAPTURED",plan:"BASIC",amount:1000,currency:"USD",version:1,at:1000});
for(const provider of ["STRIPE","RAZORPAY"] as const){
 for(const state of ["CREATED","PENDING","AUTHORIZED","CAPTURED","FAILED","REFUNDED"] as const)test(`${provider} synthetic contract normalizes ${state} and immutable identities`,()=>{
  const e={...sample(provider),state};assert.deepEqual(normalizeEvent(provider,encodeEvent(e),e.id),e);
 });
 test(`${provider} raw signature contract rejects missing, modified, wrong-secret and malformed signatures`,()=>{
  const raw=encodeEvent(sample(provider)),sig=signEvent(provider,raw,"synthetic-secret",1000);assert.equal(verifyEvent(provider,raw,sig,"synthetic-secret",1000),true);
  for(const [body,s,k] of [[raw,"","synthetic-secret"],[raw+" ",sig,"synthetic-secret"],[raw,sig,"wrong-secret"],[raw,"garbage","synthetic-secret"]])assert.equal(verifyEvent(provider,body,s,k,1000),false);
 });
 test(`${provider} synthetic contracts stop LIVE and unknown state`,()=>{
  const e=sample(provider);assert.throws(()=>normalizeEvent(provider,encodeEvent({...e,mode:"LIVE"}),e.id),/SAFETY_STOP/);
  assert.throws(()=>normalizeEvent(provider,encodeEvent(e).replace(provider==="STRIPE"?'"status":"succeeded"':'"status":"captured"','"status":"unknown"'),e.id),/UNKNOWN_PROVIDER_STATE/);
 });
 billingTriplets(["billing.failed","billing.signature_modified","billing.duplicate"],configured(provider),`${provider} `);
}
test("provider inbox identity includes provider, account, environment and event ID",()=>{
 const e=sample("STRIPE");assert.equal(new Set([eventKey(e),eventKey({...e,provider:"RAZORPAY"}),eventKey({...e,providerAccount:randomUUID()}),eventKey({...e,mode:"SYNTHETIC"})]).size,4);
});
test("Stripe-like timestamp tolerance rejects stale and future signatures",()=>{
 const raw=encodeEvent(sample("STRIPE")),sig=signEvent("STRIPE",raw,"secret",1000);assert.equal(verifyEvent("STRIPE",raw,sig,"secret",1301),false);assert.equal(verifyEvent("STRIPE",raw,sig,"secret",699),false);
});
