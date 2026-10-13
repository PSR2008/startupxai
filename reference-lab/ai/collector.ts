import { randomUUID } from "node:crypto";
import type { ExecutionGrant } from "@launchgate/contracts";
import type { TestPlan } from "../plans";
import { traceSchema,type RawTrace } from "../runner";
import { aiStateSchema } from "./contracts";
import type { AiRuntime } from "./fixture";
export async function collectAi(plan:TestPlan,g:ExecutionGrant,runtime:AiRuntime,signal:AbortSignal,consume:()=>Promise<void>,approve:(t:RawTrace)=>Promise<boolean>,pace:()=>Promise<void>=()=>new Promise(r=>setTimeout(r,500))){
 const start=Date.now(),bounded=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,g.exp*1000-Date.now()))]);
 const t:RawTrace={id:randomUUID(),initialHash:runtime.initialHash,mapping:runtime.mapping,health:false,positive:null,controlBefore:null,controlAfter:null,before:null,after:null,response:null,execution:"SETUP_FAILED",cleanup:false,requests:0,durationMs:0,completedAt:new Date().toISOString(),ai:{control:null,before:null,after:null,stable:null,statuses:[],checkpoints:[],providerOperations:0,tokenUnits:0,syntheticCost:0,realFinancialSpend:0,reason:"NONE"}};const a=t.ai!;
 const send=async(path:string,body?:unknown)=>{await pace();bounded.throwIfAborted();await consume();t.requests++;const r=await fetch(runtime.origin+path,{method:body===undefined?"GET":"POST",body:body===undefined?undefined:JSON.stringify(body),headers:{"content-type":"application/json","x-launchgate-lab-scope":runtime.scopeKey},redirect:"error",signal:AbortSignal.any([bounded,AbortSignal.timeout(1500)])});const raw=await r.text();if(Buffer.byteLength(raw)>24576)throw new Error("BODY_LIMIT");return {status:r.status,data:JSON.parse(raw)};};
 const observe=async(id:string)=>{const r=await send("/observe/"+id);if(r.status!==200)throw new Error("UNOBSERVABLE");return aiStateSchema.parse(r.data);};
 const invoke=async(body:Record<string,unknown>={},path="/invoke")=>{const r=await send(path,body);a.statuses.push(r.status);if(r.status>=500&&!(body.fail&&r.status===502))throw new Error("ADAPTER_FAILURE");};
 try{
  if(plan.ai!.mode!=="SYNTHETIC")throw new Error("SAFETY_STOP");if(plan.ai!.policy.status!=="CONFIRMED")throw new Error("REQUIRES_CONFIRMATION");
  t.health=(await send("/health")).data.healthy===true;const control=await send("/invoke",{actor:"control",model:"premium"});t.positive={status:control.status,marker:null};a.control=await observe("control");if(!await approve(t))throw new Error("UNOBSERVABLE");a.before=await observe("subject");
  const c=plan.caseId;const repeat=async(n:number,alternating=false)=>{for(let i=0;i<n;i++)await invoke(alternating?{actor:i%2?"peer":"free",instance:i%2?"B":"A"}:{});};
  if(["ai.quota","ai.reservation"].includes(c))await repeat(6);
  else if(c==="ai.organization")await repeat(6,true);
  else if(c==="ai.concurrent"||c==="ai.org_concurrent"||c==="ai.rate_concurrent"){await repeat(c==="ai.rate_concurrent"?2:4,c==="ai.org_concurrent");const r=await send("/race",Array.from({length:10},(_,i)=>c==="ai.org_concurrent"?{actor:i%2?"peer":"free",instance:i%2?"B":"A"}:{}));if(r.status!==200)throw new Error("ADAPTER_FAILURE");a.statuses.push(...r.data.statuses);}
  else if(c==="ai.distributed"){for(let i=0;i<6;i++)await invoke({instance:i%2?"B":"A"});}
  else if(c==="ai.rate"||c==="ai.rate_burst")await repeat(c==="ai.rate"?4:5);
  else if(c==="ai.rate_reset"||c==="ai.reset"){await repeat(c==="ai.reset"?5:3);await send("/clock",{now:c==="ai.reset"?1099:1009});await invoke();a.checkpoints.push(await observe("subject"));await send("/clock",{now:c==="ai.reset"?1100:1010});await invoke();}
  else if(c==="ai.org_cost")await repeat(4);
  else if(c==="ai.failure")await invoke({fail:true});
  else if(c==="ai.model_query")await invoke({},"/invoke?model=premium");
  else if(c==="ai.model_endpoint")await invoke({},"/premium");
  else if(c==="ai.model_body")await invoke({model:"premium"});
  else if(c==="ai.anonymous")await invoke({actor:"anonymous"});
  else if(c==="ai.paid")await invoke({actor:"paid",model:"premium"});
  else if(c==="ai.input")await invoke({input:9,estimate:0});
  else if(c==="ai.batch")await invoke({batch:3});
  else if(c==="ai.nesting")await invoke({depth:3});
  else if(c==="ai.cost")await invoke({actor:"paid",model:"premium",input:8,estimate:0});
  else await invoke({actor:c==="ai.expensive_anonymous"?"anonymous":c==="ai.expensive_free"?"free":"paid",model:"premium"});
  a.after=await observe("subject");a.stable=await observe("subject");t.execution="COMPLETED";
 }catch(e){const reason=(e as Error).message;a.reason=["SAFETY_STOP","REQUIRES_CONFIRMATION","UNOBSERVABLE"].includes(reason)?reason as typeof a.reason:"ADAPTER_FAILURE";t.execution=bounded.aborted?"TIMEOUT":"UNOBSERVABLE";}
 finally{try{await runtime.dispose();t.cleanup=true;}catch{}t.durationMs=Date.now()-start;t.completedAt=new Date().toISOString();const calls=[...(a.control?.calls??[]),...(a.after?.calls??[])];a.providerOperations=calls.length;a.tokenUnits=calls.reduce((n,c)=>n+c.input+c.output,0);a.syntheticCost=calls.reduce((n,c)=>n+c.cost,0);}
 return traceSchema.parse(t);
}
