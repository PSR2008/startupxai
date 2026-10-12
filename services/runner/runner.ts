import { randomUUID,type KeyObject } from "node:crypto";
import type { RunnerSubmission } from "@launchgate/contracts";
import { verifyGrant } from "./grant";
import { TargetClient,type Address,type Transport } from "./target";
import { canonical,digest } from "./metadata";

export interface RunnerControl {call(action:"start"|"check"|"request"|"evidence"|"fail",token:string,payload:unknown):Promise<void>}
export async function runProbe(token:string,key:KeyObject,control:RunnerControl,signal:AbortSignal,
 dependencies?:{resolve?:(host:string)=>Promise<Address[]>;transport?:Transport;bypass?:{host:string;secret:string}}) {
 const g=verifyGrant(token,key);const stopped=new AbortController();
 const combined=AbortSignal.any([signal,stopped.signal,AbortSignal.timeout(Math.max(1,g.exp*1000-Date.now()))]);
 await control.call("start",token,{});
 let checking=false;
 const timer=setInterval(()=>{if(!checking){checking=true;control.call("check",token,{}).catch(()=>stopped.abort()).finally(()=>{checking=false;});}},1000);
 try {
  const client=new TargetClient(g,()=>control.call("request",token,{}),dependencies?.resolve,dependencies?.transport,dependencies?.bypass);
  const response=await client.get(g.deploymentUrl,combined);combined.throwIfAborted();
  const observations=[{kind:"TRANSPORT_STATUS" as const,status:response.status}];
  const bytes=Buffer.from(canonical({observations}));
  const submission:RunnerSubmission={sequence:1,completedAt:new Date().toISOString(),grantId:g.jti,attemptId:g.attemptId,fence:g.fence,
   authorizationId:g.authorizationId,authorizationVersion:g.authorizationVersion,requestCount:1,spendMicros:0,
   artifacts:[{id:randomUUID(),bytes:bytes.toString("base64"),hash:digest(bytes),type:"PROBE_METADATA",classification:"INTERNAL",redaction:"NO_SENSITIVE_DATA"}],evidence:[],observations};
  await control.call("evidence",token,submission);
 } catch {
  stopped.abort();await control.call("fail",token,{}).catch(()=>{});
 } finally {clearInterval(timer);}
}
