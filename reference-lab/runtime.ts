// Intentionally vulnerable fixtures. Imported only by the controlled lab host
// and tests, never by Next routes or production customer-target runner code.
import { createServer,type IncomingMessage } from "node:http";
import { randomBytes,randomUUID } from "node:crypto";
import { z } from "zod";
import { identities,recipe,type CaseId,type Identity,type Variant } from "./plans";
import { canonical,digest } from "../services/runner/metadata";

export const stateSchema=z.object({exists:z.boolean(),tenant:z.enum(["A","B"]),owner:z.enum(identities),value:z.number().int(),role:z.enum(["OWNER","ADMIN","MEMBER","VIEWER","DEVELOPER","NONE"])}).strict();
export type ResourceState=z.infer<typeof stateSchema>;
export type LabFault="NONE"|"SIDE_EFFECT_403"|"SANITIZED_200"|"MASKED_404"|"ERROR_500"|"TIMEOUT"|"MISSING_CREDENTIALS"|"CLEANUP_FAILURE"|"RUNNER_FAILURE"|"ACTION_DISABLED";
let active=0;
export const activeFixtures=()=>active;
export interface LabRuntime {origin:string;scopeKey:string;mapping:{identities:Record<Identity,string>;resources:Record<string,string>};tokens:Record<Identity,string>;initialHash:string;dispose():Promise<void>}
export async function startFixture(caseId:CaseId,variant:Variant,seed:string,fault:LabFault="NONE"):Promise<LabRuntime> {
 const scopeKey=randomBytes(32).toString("hex");
 const userIds=Object.fromEntries(identities.map(i=>[i,randomUUID()])) as Record<Identity,string>;
 const resources={resource_a:randomUUID(),resource_b:randomUUID()};
 const roles:Record<Identity,ResourceState["role"]>={anonymous:"NONE",tenant_a_owner:"OWNER",tenant_a_member:"MEMBER",tenant_a_viewer:"VIEWER",tenant_a_developer:"DEVELOPER",tenant_b_owner:"OWNER",tenant_b_member:"MEMBER"};
 const data:Record<string,ResourceState>={resource_a:{exists:true,tenant:"A",owner:"tenant_a_owner",value:7,role:"NONE"},resource_b:{exists:true,tenant:"B",owner:"tenant_b_owner",value:7,role:"NONE"}};
 const tokens=Object.fromEntries(identities.map(i=>[i,i==="anonymous"?"":randomBytes(24).toString("hex")])) as Record<Identity,string>;
 const sessions=new Map(Object.entries(tokens).filter(([,token])=>token).map(([i,token])=>[token,i as Identity]));
 const initialHash=digest(canonical({seed,family:recipe(caseId).family,version:1,data,roles}));
 const expired=new Set<string>();
 const user=(req:IncomingMessage)=>{const token=req.headers.authorization?.replace(/^Bearer /,"")??"";return expired.has(token)?undefined:sessions.get(token);};
 const server=createServer(async(req,res)=>{
  const reply=(status:number,value:unknown)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(value));};
  if(req.headers["x-launchgate-lab-scope"]!==scopeKey)return reply(403,{});
  const path=req.url??"";let input:Record<string,unknown>={};
  try{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>2048)throw new Error();chunks.push(chunk);}if(size)input=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(400,{});}
  if(path==="/health")return reply(200,{healthy:true,family:recipe(caseId).family,version:1});
  if(path.startsWith("/observe/")){
   if(variant==="inconclusive")return reply(503,{});
   const logical=path.slice(9);
   const state=data[logical]??(logical in roles?{exists:true,tenant:logical.startsWith("tenant_b")?"B":"A",owner:logical,value:0,role:roles[logical as Identity]}:null);
   return reply(state?200:404,state??{});
  }
  const actor=user(req);const attack=req.headers["x-launchgate-lab-phase"]==="adversarial";
  if(attack&&fault==="TIMEOUT")return; // Harness destroys socket on timeout/disposal.
  if(fault==="ERROR_500"||fault==="RUNNER_FAILURE")return reply(500,{});
  if(path==="/logout"){if(actor&&variant!=="vulnerable")sessions.delete(req.headers.authorization!.slice(7));return reply(200,{loggedOut:true});}
  if(path==="/expire"){expired.add(req.headers.authorization?.slice(7)??"");return reply(200,{expired:true});}
  const vulnerable=variant==="vulnerable"||fault==="SIDE_EFFECT_403";
  if(["/protected/api","/protected/route","/protected/action"].includes(path)){
   if(!actor&&!vulnerable)return reply(fault==="SANITIZED_200"?200:401,{public:true});
   if(path==="/protected/action"&&fault!=="ACTION_DISABLED")data.resource_b.value++;
   return reply(200,{marker:"PRIVATE_B",actionReached:path.endsWith("action")});
  }
  const rid=path.match(/^\/resources\/([a-f0-9-]{36})$/)?.[1];
  if(rid){
   const logical=Object.keys(resources).find(k=>resources[k as keyof typeof resources]===rid);if(!logical)return reply(404,{});
   const state=data[logical];const permitted=actor&&(actor.startsWith("tenant_b")?"B":"A")===state.tenant;
   if(!permitted&&!vulnerable)return reply(fault==="SANITIZED_200"?200:fault==="MASKED_404"?404:403,{public:true});
   if(req.method==="PATCH")state.value=8;if(req.method==="DELETE")state.exists=false;
   if(fault==="SIDE_EFFECT_403"&&attack)return reply(403,{});
   return reply(200,{marker:logical==="resource_b"?"PRIVATE_B":"PRIVATE_A",value:state.value,exists:state.exists});
  }
  const uid=path.match(/^\/members\/([a-f0-9-]{36})\/role$/)?.[1];
  if(uid){
   const target=identities.find(i=>userIds[i]===uid);if(!target)return reply(404,{});
   const permitted=actor&&roles[actor]==="OWNER"&&actor.startsWith("tenant_a");
   if(!permitted&&!vulnerable)return reply(403,{});
   const role=z.enum(["OWNER","ADMIN","DEVELOPER"]).safeParse(input.role);if(!role.success)return reply(400,{});
   roles[target]=role.data;return reply(fault==="SIDE_EFFECT_403"&&attack?403:200,{changed:true});
  }
  return reply(404,{});
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("LAB_BIND");
 active++;
 if(fault==="MISSING_CREDENTIALS")tokens.tenant_b_owner="";
 let disposed=false;
 return {origin:`http://127.0.0.1:${address.port}`,scopeKey,mapping:{identities:userIds,resources},tokens,initialHash,
  async dispose(){if(!disposed){disposed=true;server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));active--;sessions.clear();for(const k of identities)tokens[k]="";}
   if(fault==="CLEANUP_FAILURE")throw new Error("CLEANUP_UNCONFIRMED");}};
}
