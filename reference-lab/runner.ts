import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ExecutionGrant } from "@launchgate/contracts";
import { targetUrl } from "../services/runner/target";
import { canonical } from "../services/runner/metadata";
import { validatePlan,type TestPlan,type Identity } from "./plans";
import { stateSchema,type LabRuntime } from "./runtime";
import { billingTraceSchema } from "./billing/contracts";

const responseSchema=z.object({status:z.number().int().min(100).max(599),marker:z.enum(["PRIVATE_A","PRIVATE_B"]).nullable()}).strict();
export const traceSchema=z.object({id:z.string().uuid(),initialHash:z.string().regex(/^sha256:[a-f0-9]{64}$/),
 mapping:z.object({identities:z.record(z.string().uuid()),resources:z.record(z.string().uuid())}).strict(),
 health:z.boolean(),positive:responseSchema.nullable(),controlBefore:stateSchema.nullable(),controlAfter:stateSchema.nullable(),
 before:stateSchema.nullable(),after:stateSchema.nullable(),response:responseSchema.nullable(),
 execution:z.enum(["COMPLETED","TIMEOUT","MISSING_CREDENTIALS","SETUP_FAILED","RUNNER_ERROR","UNOBSERVABLE"]),cleanup:z.boolean(),
 requests:z.number().int().min(0).max(64),durationMs:z.number().int().min(0).max(120000),completedAt:z.string().datetime(),billing:billingTraceSchema.optional()}).strict();
export type RawTrace=z.infer<typeof traceSchema>;
/** Fixed operation collector only. No assertions or final verdicts execute here.
 * LabRuntime is created by the controlled fixture host, never deserialized from
 * a browser/grant. No arbitrary URL/HTTP program parameter is accepted. */
export async function collectTrace(planInput:TestPlan,g:ExecutionGrant,runtime:LabRuntime,signal:AbortSignal,consume:()=>Promise<void>,approveNegative:(trace:RawTrace)=>Promise<boolean>,pace:()=>Promise<void>=()=>new Promise(r=>setTimeout(r,500))):Promise<RawTrace> {
 const plan=validatePlan(planInput);targetUrl(g.deploymentUrl,"reference-lab.invalid");
 const started=Date.now();
 const t:RawTrace={id:randomUUID(),initialHash:runtime.initialHash,mapping:runtime.mapping,health:false,positive:null,controlBefore:null,controlAfter:null,before:null,after:null,response:null,execution:"SETUP_FAILED",cleanup:false,requests:0,durationMs:0,completedAt:new Date().toISOString()};
 const bounded=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(plan.budget.durationMs,g.exp*1000-Date.now())))]);
 const send=async(path:string,method="GET",identity:Identity="anonymous",body?:unknown,attack=false,tokenOverride?:string)=>{
  if(t.requests>=plan.budget.requests||Date.now()>=g.exp*1000)throw new Error("BUDGET");
  await pace();bounded.throwIfAborted();await consume();bounded.throwIfAborted();t.requests++;
  const token=tokenOverride??runtime.tokens[identity];
  const r=await fetch(`${runtime.origin}${path}`,{method,redirect:"error",signal:AbortSignal.any([bounded,AbortSignal.timeout(750)]),headers:{"x-launchgate-lab-scope":runtime.scopeKey,"x-launchgate-lab-phase":attack?"adversarial":"control",...(token?{authorization:`Bearer ${token}`}:{ }),"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  const reader=r.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>8192){await reader.cancel();throw new Error("BODY_LIMIT");}chunks.push(p.value);}}finally{reader.releaseLock();}
  return {status:r.status,data:JSON.parse(Buffer.concat(chunks).toString()||"{}") as Record<string,unknown>};
 };
 const observe=async(logical:string)=>{const r=await send(`/observe/${logical}`);if(r.status!==200)throw new Error("UNOBSERVABLE");return stateSchema.parse(r.data);};
 const summarized=(r:{status:number;data:Record<string,unknown>})=>responseSchema.parse({status:r.status,marker:["PRIVATE_A","PRIVATE_B"].includes(String(r.data.marker))?r.data.marker:null});
 const route=plan.caseId==="auth.route"?"/protected/route":plan.caseId==="auth.action"?"/protected/action":"/protected/api";
 const role=plan.caseId==="role.member_admin"?"ADMIN":plan.caseId==="role.viewer_developer"?"DEVELOPER":"OWNER";
 try {
  const health=await send("/health");t.health=health.status===200&&health.data.healthy===true;
  if(!t.health)throw new Error("SETUP_FAILED");
  if(!runtime.tokens.tenant_b_owner)throw new Error("MISSING_CREDENTIALS");
  const controlResource=plan.family==="privilege_escalation"?(plan.logicalActor==="tenant_a_viewer"?"tenant_a_member":"tenant_a_viewer"):plan.caseId==="tenant.read"||plan.family==="auth_session_boundaries"?"resource_b":"resource_a";
  t.controlBefore=await observe(controlResource);
  if(plan.family==="auth_session_boundaries")t.positive=summarized(await send(route,plan.caseId==="auth.action"?"POST":"GET","tenant_b_owner"));
  else if(plan.family==="privilege_escalation")t.positive=summarized(await send(`/members/${runtime.mapping.identities[controlResource as Identity]}/role`,"PATCH","tenant_a_owner",{role}));
  else t.positive=summarized(await send(`/resources/${runtime.mapping.resources[controlResource]}`,plan.caseId==="tenant.write"?"PATCH":plan.caseId==="tenant.delete"?"DELETE":"GET",controlResource==="resource_a"?"tenant_a_owner":"tenant_b_owner",plan.caseId==="tenant.write"?{value:8}:undefined));
  t.controlAfter=await observe(controlResource);
  if(!await approveNegative(t))throw new Error("SETUP_FAILED");
  t.before=await observe(plan.logicalResource);
  if(plan.caseId==="auth.logout"||plan.caseId==="auth.expired"){
   await send(plan.caseId==="auth.logout"?"/logout":"/expire","POST","tenant_b_owner");
   t.response=summarized(await send(route,"GET","tenant_b_owner",undefined,true));
  }else if(plan.family==="auth_session_boundaries")t.response=summarized(await send(route,plan.caseId==="auth.action"?"POST":"GET","anonymous",undefined,true,plan.caseId==="auth.invalid"?"invalid-synthetic-session":undefined));
  else if(plan.family==="privilege_escalation")t.response=summarized(await send(`/members/${runtime.mapping.identities[plan.logicalActor]}/role`,"PATCH",plan.logicalActor,{role},true));
  else t.response=summarized(await send(`/resources/${runtime.mapping.resources.resource_b}`,plan.caseId==="tenant.write"?"PATCH":plan.caseId==="tenant.delete"?"DELETE":"GET",plan.logicalActor,plan.caseId==="tenant.write"?{value:8}:undefined,true));
  t.after=await observe(plan.logicalResource);t.execution="COMPLETED";
 }catch(error){const code=(error as Error).message;t.execution=code==="MISSING_CREDENTIALS"?"MISSING_CREDENTIALS":code==="UNOBSERVABLE"?"UNOBSERVABLE":bounded.aborted||(error as Error).name.includes("Timeout")?"TIMEOUT":"RUNNER_ERROR";}
 finally{try{await runtime.dispose();t.cleanup=true;}catch{t.cleanup=false;}t.durationMs=Math.min(60000,Date.now()-started);t.completedAt=new Date().toISOString();}
 const parsed=traceSchema.parse(t);if(Buffer.byteLength(canonical(parsed))>plan.budget.artifactBytes)throw new Error("TRACE_LIMIT");return parsed;
}
