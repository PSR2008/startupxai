import { createServer } from "node:http";
import { randomUUID,randomBytes } from "node:crypto";
import { mkdtemp,rm } from "node:fs/promises";
import { join,resolve,sep } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { digest,canonical } from "../../services/runner/metadata";
import { barrier,TestClock } from "../billing/fixture";
import type { TestPlan,Variant } from "../plans";
import { type AiState,type AiFault } from "./contracts";
import { syntheticCall } from "./provider";
const requestSchema=z.object({actor:z.enum(["anonymous","free","peer","paid","control"]).default("free"),model:z.enum(["small","premium"]).default("small"),input:z.number().int().min(1).max(32).default(2),batch:z.number().int().min(1).max(4).default(1),depth:z.number().int().min(1).max(4).default(1),estimate:z.number().int().min(0).max(100).default(0),fail:z.boolean().default(false),instance:z.enum(["A","B"]).default("A")}).strict();
type Request=z.infer<typeof requestSchema>;
const initial=():AiState=>({now:1000,calls:[],usage:{},reserved:0,costReserved:0,costCommitted:0,orgUsage:0,rate:{},reservations:0,sequence:0});
let active=0;export const activeAiFixtures=()=>active;
export async function startAiFixture(plan:TestPlan,variant:Variant,fault:AiFault="NONE"){
 const config=plan.ai!,policy=config.policy.status==="CONFIRMED"?config.policy:null,clock=new TestClock(),key=randomBytes(32).toString("hex");
 const root=await mkdtemp(join(tmpdir(),"launchgate-ai-")),file=join(root,"state.sqlite"),db=new DatabaseSync(file),peer=new DatabaseSync(file);
 db.exec("PRAGMA journal_mode=WAL; CREATE TABLE state(id TEXT PRIMARY KEY,value TEXT NOT NULL)");
 for(const id of ["control","subject"])db.prepare("INSERT INTO state VALUES(?,?)").run(id,JSON.stringify(initial()));
 const read=(id:string,connection=db)=>JSON.parse(connection.prepare("SELECT value FROM state WHERE id=?").get(id)!.value as string) as AiState;
 const save=(id:string,s:AiState,connection=db)=>connection.prepare("UPDATE state SET value=? WHERE id=?").run(JSON.stringify(s),id);
 const invoke=async(r:Request,meet?:()=>Promise<void>):Promise<number>=>{
  if(!policy||config.mode!=="SYNTHETIC")return 503;
  const id=r.actor==="control"?"control":"subject",bad=variant==="vulnerable"&&id==="subject",connection=r.instance==="B"?peer:db;
  if(variant==="inconclusive"||fault==="REJECT_ALL")return 503;
  if(id==="subject"&&fault==="BEFORE_500")return 500;
  if(id==="subject"&&fault==="TIMEOUT"){await new Promise(resolve=>setTimeout(resolve,100));return 504;}
  if(!bad)connection.exec("BEGIN IMMEDIATE");
  const s=read(id,connection);if(s.calls.length>=40){if(!bad)connection.exec("ROLLBACK");throw new Error("PROVIDER_LIMIT");}
  if(!bad&&Math.floor((clock.now-1000)/100)>Math.floor((s.now-1000)/100)){s.usage={};s.orgUsage=0;s.costCommitted=0;s.rate={};}
  s.now=clock.now;const maximum=(r.input+2)*(r.model==="premium"?2:1),window=Math.floor((clock.now-1000)/policy.rate.window);
  const rateKey=bad&&plan.caseId==="ai.distributed"?r.instance:"shared";
  const rate=s.rate[rateKey]?.window===window?s.rate[rateKey]:{window,count:0};
  const denied=r.actor==="anonymous"||r.model==="premium"&&!["paid","control"].includes(r.actor)||r.input>policy.maxInput||r.batch>policy.maxBatch||r.depth>policy.maxDepth||maximum>policy.requestCost||(s.usage[r.actor]??0)+s.reserved>=policy.userLimit||s.orgUsage+s.reserved>=policy.orgLimit||s.costCommitted+s.costReserved+maximum>policy.orgCost||rate.count>=policy.rate.limit+policy.rate.burst;
  const localDenied=bad&&plan.caseId==="ai.distributed"&&rate.count>=policy.rate.limit+policy.rate.burst;
  if(!bad&&denied||localDenied){save(id,s,connection);if(!bad)connection.exec("COMMIT");return 429;}
  // Fixed reservation is committed before any asynchronous provider work.
  let reservationSequence=0;
  if(!bad){try{s.reserved++;s.costReserved+=maximum;s.reservations++;reservationSequence=++s.sequence;rate.count++;s.rate[rateKey]=rate;save(id,s,connection);connection.exec("COMMIT");}catch(e){connection.exec("ROLLBACK");throw e;}}
  if(meet)await meet();
  if(!bad)connection.exec("BEGIN IMMEDIATE");
  const current=read(id,connection);current.now=clock.now;
  if(bad){rate.count++;current.rate[rateKey]=rate;}
  const model=bad&&["ai.paid","ai.expensive_paid"].includes(plan.caseId)?"small":r.model;
  const call=syntheticCall(config,{actor:r.actor,model,input:r.input,fail:r.fail,reservationSequence,invocationSequence:++current.sequence});current.calls.push(call);
  const charge=r.fail?(policy.failed==="RESERVED_ONLY"?1:0):1;
  if(!bad){current.reserved--;current.costReserved-=maximum;}
  const actualCharge=bad&&r.fail?1-charge:charge;
  // Legacy-equivalent bug: quota recording after provider work may return 429.
  if(!bad||!denied){current.usage[r.actor]=(current.usage[r.actor]??0)+actualCharge;current.orgUsage+=actualCharge;current.costCommitted+=r.fail?(actualCharge?maximum:0):call.cost;}
  save(id,current,connection);if(!bad)connection.exec("COMMIT");return r.fail?502:bad&&denied?429:200;
 };
 const server=createServer(async(req,res)=>{const reply=(code:number,value:unknown)=>{res.writeHead(code,{"content-type":"application/json"});res.end(JSON.stringify(value));};
  if(req.headers["x-launchgate-lab-scope"]!==key)return reply(403,{});
  try{const url=new URL(req.url!,"http://local");
   if(url.pathname==="/health")return reply(200,{healthy:true});
   if(url.pathname.startsWith("/observe/")){if(fault==="OBSERVATION")return reply(503,{});const id=url.pathname.split("/")[2];if(!["control","subject"].includes(id))return reply(404,{});return reply(200,read(id));}
   let bytes=0;const chunks:Buffer[]=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)return reply(413,{});chunks.push(chunk);}const raw=JSON.parse(Buffer.concat(chunks).toString()||"{}");
   if(url.pathname==="/clock"){clock.advance(z.object({now:z.number()}).strict().parse(raw).now);return reply(200,{});}
   if(url.pathname==="/race"){const items=z.array(requestSchema).length(10).parse(raw);const meet=barrier(10);
    // All callers rendezvous before fixed admission; vulnerable callers race
    // after their stale read and before provider work.
    const statuses=variant==="vulnerable"?await Promise.all(items.map(r=>invoke(r,meet))):await Promise.all(items.map(async r=>{await meet();return invoke(r);}));return reply(200,{statuses});}
   if(["/invoke","/premium"].includes(url.pathname)){const r=requestSchema.parse({...raw,...(url.searchParams.has("model")?{model:url.searchParams.get("model")}:{ }),...(url.pathname==="/premium"?{model:"premium"}:{})});return reply(await invoke(r),{});}
   reply(404,{});
  }catch{reply(500,{});}
 });await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));active++;let disposed=false;
 const subject=randomUUID();return {origin:`http://127.0.0.1:${(server.address() as {port:number}).port}`,scopeKey:key,initialHash:digest(canonical({state:initial(),seed:plan.seed,config})),mapping:{identities:{tenant_a_member:subject,subject,control:randomUUID(),peer:randomUUID()},resources:{ai_subject:randomUUID()}},async dispose(){if(disposed)return;disposed=true;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));peer.close();db.close();const target=resolve(root);if(!target.startsWith(resolve(tmpdir())+sep+"launchgate-ai-"))throw new Error("CLEANUP_SCOPE");await rm(target,{recursive:true,force:true});active--;if(fault==="CLEANUP")throw new Error("CLEANUP");}};
}
export type AiRuntime=Awaited<ReturnType<typeof startAiFixture>>;
