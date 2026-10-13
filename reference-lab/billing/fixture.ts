// Intentionally vulnerable synthetic application; never imported by Next routes.
import { createServer } from "node:http";
import { randomBytes,randomUUID } from "node:crypto";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonical,digest } from "../../services/runner/metadata";
import type { TestPlan,Variant } from "../plans";
import { plans,snapshotSchema,type AccountState,type BillingEvent,type BillingFault } from "./contracts";
import { eventKey,normalizeEvent,safeMode,verifyEvent } from "./provider";

const free=():AccountState=>({plan:"FREE",payment:"CREATED",subscription:"FREE",start:null,end:null,source:null,credits:0,effects:0,version:0,cancelAt:null,pendingPlan:null,order:null});
type State={now:number;accounts:Record<"control"|"subject",AccountState>};
let active=0;
export const activeBillingFixtures=()=>active;
export class TestClock {constructor(public now=1000){} advance(value:number){if(!Number.isSafeInteger(value)||value<this.now||value>1200)throw new Error("CLOCK_SCOPE");this.now=value;return value;}}
export function barrier(parties:number){let arrived=0;let release!:()=>void;const ready=new Promise<void>(r=>{release=r;});return async()=>{if(++arrived===parties)release();await ready;};}
export interface BillingRuntime {origin:string;scopeKey:string;secret:string;mapping:{identities:Record<string,string>;resources:Record<string,string>};initialHash:string;dispose():Promise<void>}
export async function startBillingFixture(plan:TestPlan,variant:Variant,fault:BillingFault="NONE"):Promise<BillingRuntime>{
 const config=plan.billing!;const scopeKey=randomBytes(32).toString("hex"),secret=randomBytes(32).toString("hex");
 const subjectId=randomUUID();
 const mapping={identities:{control:randomUUID(),subject:subjectId,tenant_a_member:subjectId,provider:randomUUID()},resources:Object.fromEntries(["billing_subject","order_control","order_subject","payment_control","payment_subject","subscription_control","subscription_subject","invoice_control","invoice_subject","refund_subject","event_control","event_subject","event_second","event_third"].map(k=>[k,randomUUID()]))};
 const initial:State={now:1000,accounts:{control:free(),subject:free()}};const clock=new TestClock();
 const root=await mkdtemp(join(tmpdir(),"launchgate-billing-")),file=join(root,"fixture.sqlite");let db=new DatabaseSync(file);let disposed=false;
 db.exec("PRAGMA journal_mode=WAL; CREATE TABLE state(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL); CREATE TABLE inbox(event_key TEXT PRIMARY KEY, account TEXT NOT NULL);");
 db.prepare("INSERT INTO state VALUES(1,?)").run(JSON.stringify(initial));
 const read=()=>JSON.parse(db.prepare("SELECT value FROM state WHERE id=1").get()!.value as string) as State;
 const save=(state:State)=>db.prepare("UPDATE state SET value=? WHERE id=1").run(JSON.stringify(state));
 const policy=config.policy.status==="CONFIRMED"?config.policy:null;
 const revoke=(a:AccountState,status:"CANCELLED"|"EXPIRED")=>{a.plan="FREE";a.credits=0;a.subscription=status;a.effects++;a.cancelAt=null;};
 const activate=(s:State,a:AccountState,tier:"BASIC"|"PRO")=>{a.plan=tier;a.credits=plans[tier].credits;a.start=s.now;a.end=s.now+100;a.source="payment";a.subscription="ACTIVE";a.effects++;};
 const mutate=(s:State,e:BillingEvent,bad:boolean)=>{
  if(e.account==="foreign")return;
  const a=s.accounts[e.account];if(e.kind==="NOOP")return;
  if(!bad&&e.version<=a.version)return;
  a.version=e.version;a.payment=e.state;
  if(e.kind==="PAYMENT"){
   if(e.state==="CAPTURED"||bad){activate(s,a,e.plan);if(bad&&plan.caseId==="billing.success"){a.effects++;a.credits+=plans[e.plan].credits;}}
  }else if(e.kind==="CANCEL"){
   if(!bad&&policy){if(policy.cancel==="IMMEDIATE")revoke(a,"CANCELLED");else a.cancelAt=a.end;}
  }else if(e.kind==="UPGRADE"){
   if(!bad)activate(s,a,"PRO");
  }else if(e.kind==="DOWNGRADE"){
   if(!bad&&policy){if(policy.downgrade==="IMMEDIATE")activate(s,a,"BASIC");else a.pendingPlan="BASIC";}
  }else if(e.kind==="REFUND"&&!bad&&policy){
   if(policy.refund==="REVOKE")revoke(a,"CANCELLED");else{a.subscription="REFUND_REVIEW";a.effects++;}
  }
 };
 const deliver=async(raw:string,signature:string,eventId:string,meet?:()=>Promise<void>)=>{
  safeMode(config.mode);const e=normalizeEvent(config.provider,raw,eventId);safeMode(e.mode);
  const bad=variant==="vulnerable"&&e.account!=="control";
  if(e.providerAccount!==mapping.identities.provider||e.mode!==config.mode)throw new Error("UNKNOWN_PROVIDER_STATE");
  if(fault==="REJECT_ALL"||!bad&&!verifyEvent(config.provider,raw,signature,secret,clock.now))return 403;
  if(e.account==="foreign")return 403;
  const state=read(),a=state.accounts[e.account],order=a.order;
  if(!bad&&(!order||e.orderId!==mapping.resources[`order_${e.account}`]||e.paymentId!==mapping.resources[`payment_${e.account}`]||e.subscriptionId!==mapping.resources[`subscription_${e.account}`]||e.invoiceId!==mapping.resources[`invoice_${e.account}`]||e.kind==="REFUND"&&(e.amount!==order.amount||e.refundId!==mapping.resources.refund_subject)||e.kind==="PAYMENT"&&(e.plan!==order.plan||e.amount!==order.amount||e.currency!==order.currency)))return 403;
  const key=eventKey(e);
  if(bad){
   // Deliberately wrong: dedup read outside a transaction, then racing effects.
   const seen=!!db.prepare("SELECT 1 FROM inbox WHERE event_key=?").get(key);
   if(meet)await meet();
   if(!seen||plan.caseId!=="billing.concurrent"){
    const s=read();mutate(s,e,true);save(s);db.prepare("INSERT OR IGNORE INTO inbox VALUES(?,?)").run(key,e.account);
   }
  }else{
   if(meet)await meet();
   db.exec("BEGIN IMMEDIATE");
   try{
    const inserted=db.prepare("INSERT OR IGNORE INTO inbox VALUES(?,?)").run(key,e.account).changes;
    if(inserted){const s=read();mutate(s,e,false);save(s);if(fault==="TRANSACTION_FAILURE"&&e.account==="subject")throw new Error("ADAPTER_FAILURE");}
    db.exec("COMMIT");
   }catch(error){db.exec("ROLLBACK");throw error;}
  }
  return fault==="MUTATE_500"&&e.account==="subject"?500:200;
 };
 const server=createServer(async(req,res)=>{
  const reply=(status:number,value:unknown={})=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(value));};
  if(req.headers["x-launchgate-lab-scope"]!==scopeKey)return reply(403);
  const path=req.url??"";
  try{
   let bytes=0;const chunks:Buffer[]=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>12288)throw new Error("BODY_LIMIT");chunks.push(chunk);}const raw=Buffer.concat(chunks).toString();const body=raw?JSON.parse(raw):{};
   if(path==="/health")return reply(200,{healthy:true});
   if(path.startsWith("/observe/")){
    if(variant==="inconclusive"||fault==="OBSERVATION_FAILED")return reply(503);
    const who=path.slice(9);if(who!=="control"&&who!=="subject")return reply(404);
    const s=read();return reply(200,snapshotSchema.parse({now:s.now,account:s.accounts[who],inbox:Number(db.prepare("SELECT count(*) AS n FROM inbox WHERE account=?").get(who)!.n)}));
   }
   if(path.startsWith("/export/")){
    const who=path.slice(8);if(who!=="control"&&who!=="subject")return reply(404);
    return reply(read().accounts[who].plan==="FREE"?403:200,{allowed:read().accounts[who].plan!=="FREE"});
   }
   safeMode(config.mode);
   if(path==="/order"){
    if(body.account!=="control"&&body.account!=="subject"||!(body.plan in plans))return reply(400);
    const tier=body.plan as keyof typeof plans;const s=read(),a=s.accounts[body.account as "control"|"subject"];
    const bad=variant==="vulnerable"&&body.account==="subject";
    a.order={plan:tier,account:body.account,amount:bad?body.amount:plans[tier].amount,currency:bad?body.currency:plans[tier].currency};save(s);return reply(200);
   }
   if(path==="/webhook"||path==="/concurrent"){
    const adversarial=req.headers["x-launchgate-lab-phase"]==="adversarial";
    if(adversarial&&fault==="ADAPTER_TIMEOUT")return;
    if(adversarial&&fault==="UNKNOWN_STATE")throw new Error("UNKNOWN_PROVIDER_STATE");
    if(path==="/concurrent"){
     const meet=barrier(2);const statuses=await Promise.all([deliver(body.raw,body.signature,body.eventId,meet),deliver(body.raw,body.signature,body.eventId,meet)]);return reply(Math.max(...statuses));
    }
    return reply(await deliver(body.raw,body.signature,body.eventId));
   }
   if(path==="/clock"){
    const s=read();s.now=clock.advance(body.now);
    for(const who of ["control","subject"] as const){
     const a=s.accounts[who];if(who==="subject"&&variant==="vulnerable")continue;
     if(a.plan!=="FREE"&&a.end!==null&&s.now>=a.end){
      if(a.pendingPlan){const next=a.pendingPlan;a.pendingPlan=null;activate(s,a,next);}
      else revoke(a,a.cancelAt!==null?"CANCELLED":"EXPIRED");
     }
    }
    save(s);return reply(200);
   }
   if(path==="/restart"){db.close();db=new DatabaseSync(file);return reply(200);}
   if(path==="/client-plan"){
    if(variant==="vulnerable"){const s=read();activate(s,s.accounts.subject,"PRO");save(s);return reply(200);}return reply(403);
   }
   return reply(404);
  }catch(error){return reply(503,{reason:(error as Error).message==="SAFETY_STOP"?"SAFETY_STOP":(error as Error).message==="UNKNOWN_PROVIDER_STATE"?"UNKNOWN_PROVIDER_STATE":"ADAPTER_FAILURE"});}
 });
 await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});active++;
 const address=server.address();if(!address||typeof address==="string")throw new Error("LAB_BIND");
 return {origin:`http://127.0.0.1:${address.port}`,scopeKey,secret,mapping,initialHash:digest(canonical({seed:plan.seed,config,state:initial})),async dispose(){
  if(!disposed){disposed=true;server.closeAllConnections();await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));db.close();active--;
   const target=resolve(root),base=resolve(tmpdir())+sep;if(!target.startsWith(base)||!target.slice(base.length).startsWith("launchgate-billing-"))throw new Error("CLEANUP_SCOPE");await rm(target,{recursive:true,force:true});}
  if(fault==="CLEANUP_FAILURE")throw new Error("CLEANUP_UNCONFIRMED");
 }};
}
