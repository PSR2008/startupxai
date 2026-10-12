import "server-only";
import { createClient,type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { VerifiedPrincipal } from "../auth/principal";
import { requireProjectAccess,requireOrganizationRole } from "../launchgate/authorization";
import { authorizationReader,databaseError } from "../launchgate/database";
import { configuredValue } from "../env";
import { ApiError } from "../http/api-error";
import { boundedBody } from "../github/provider";
import { VercelProvider } from "../vercel/provider";
import { rpcExecutionStore } from "../../../services/orchestrator/store";

const uuid=z.string().uuid();
export function executionStore(){
 const url=configuredValue("NEXT_PUBLIC_SUPABASE_URL"),key=configuredValue("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)throw new ApiError("CONFIGURATION_UNAVAILABLE");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return rpcExecutionStore(async(name,args)=>client.rpc(name,args));
}
// Operator-provisioned org/project bindings. Credentials never come from browser
// input and never leave this server adapter. Missing configuration fails closed.
function vercelConfig(projectId:string,organizationId:string) {
 const text=process.env.LAUNCHGATE_VERCEL_CONNECTIONS;if(!text)throw new ApiError("CONFIGURATION_UNAVAILABLE");
 try {
  const entries=z.array(z.object({projectId:uuid,organizationId:uuid,credentialReference:uuid,accountId:z.string().regex(/^team_[A-Za-z0-9]+$/),providerProjectId:z.string().regex(/^prj_[A-Za-z0-9]+$/),token:z.string().min(20).max(512)}).strict()).max(100).parse(JSON.parse(text));
  const c=entries.find(c=>c.projectId===projectId&&c.organizationId===organizationId);if(!c)throw new Error();return c;
 }catch{throw new ApiError("CONFIGURATION_UNAVAILABLE");}
}
async function body<T>(request:Request,schema:z.ZodType<T>){
 if(!request.headers.get("content-type")?.startsWith("application/json"))throw new ApiError("INVALID_REQUEST");
 try{return schema.parse(JSON.parse(Buffer.from(await boundedBody(new Response(request.body),16384)).toString("utf8")));}catch{throw new ApiError("INVALID_REQUEST");}
}
export async function executionRoute(request:Request,session:{principal:VerifiedPrincipal;db:SupabaseClient},path:string[],correlationId:string){
 const {principal,db}=session;const projectId=uuid.parse(path[1]);const reader=authorizationReader(db);
 const context=await requireProjectAccess(reader,principal,projectId);
 const respond=(data:unknown,status=200)=>Response.json({ok:true,data,correlationId},{status,headers:{"Cache-Control":"no-store","X-Correlation-ID":correlationId}});
 const role=(minimum:"ADMIN"|"DEVELOPER")=>requireOrganizationRole(reader,principal,context.organizationId,minimum);
 const command=async(action:string,data:unknown)=>{const r=await db.rpc("lg_execution_command",{p_project:projectId,p_action:action,p_data:data,p_correlation:correlationId});databaseError(r.error);return r.data;};
 if(path[2]==="environments"&&path.length===3&&request.method==="POST"){
  await role("ADMIN");return respond(await command("ENVIRONMENT",await body(request,z.object({name:z.string().trim().min(1).max(100),type:z.enum(["PREVIEW","STAGING","SANDBOX"])}).strict())),201);
 }
 if(path[2]==="environments"&&path.length===5&&path[4]==="deployments"&&request.method==="POST"){
  await role("ADMIN");const environmentId=uuid.parse(path[3]);
  const input=await body(request,z.object({deploymentId:z.string().regex(/^dpl_[A-Za-z0-9]+$/),snapshotId:uuid}).strict());
  const s=await db.from("lg_repository_snapshots").select("id,connection_id,commit_sha,state").eq("project_id",projectId).eq("id",input.snapshotId).single();databaseError(s.error);
  if(!s.data||s.data.state!=="COMPLETE")throw new ApiError("ACCESS_DENIED");
  const c=await db.from("lg_repository_connections").select("repository_id,status").eq("project_id",projectId).eq("id",s.data.connection_id).single();databaseError(c.error);
  if(!c.data||c.data.status!=="ACTIVE")throw new ApiError("ACCESS_DENIED");
  const repo=await db.from("lg_installation_repositories").select("repository_id").eq("id",c.data.repository_id).single();databaseError(repo.error);
  const config=vercelConfig(projectId,context.organizationId);
  const verified=await new VercelProvider({...config,status:"ACTIVE"}).verify({organizationId:context.organizationId,projectId,deploymentId:input.deploymentId,commitSha:s.data.commit_sha,repositoryId:repo.data!.repository_id});
  const store=executionStore();
  const connection=z.object({id:uuid}).parse(await store.command("CONNECT",{projectId,actorId:principal.userId,accountId:config.accountId,providerProjectId:config.providerProjectId,credentialReference:config.credentialReference}));
  return respond(await store.command("DEPLOYMENT",{projectId,actorId:principal.userId,environmentId,connectionId:connection.id,repositoryConnectionId:s.data.connection_id,...verified}),201);
 }
 if(path[2]==="targets"&&path.length===4&&path[3]==="authorize"&&request.method==="POST"){
  await role("ADMIN");return respond(await command("AUTHORIZE",await body(request,z.object({deploymentId:uuid,requestKey:uuid,expiresAt:z.string().datetime(),requestLimit:z.number().int().min(1).max(1000).default(100),concurrencyLimit:z.number().int().min(1).max(2).default(1),durationSeconds:z.number().int().min(1).max(900).default(60)}).strict())),201);
 }
 if(path[2]==="targets"&&path.length===5&&path[4]==="revoke"&&request.method==="POST"){
  await role("ADMIN");await body(request,z.object({}).strict());return respond(await command("REVOKE",{authorizationId:uuid.parse(path[3])}));
 }
 if(path[2]==="vercel"&&path.length===4&&path[3]==="revoke"&&request.method==="POST"){
  await role("ADMIN");return respond(await command("REVOKE_CONNECTION",await body(request,z.object({connectionId:uuid}).strict())));
 }
 if(path[2]==="runs"&&path.length===3&&request.method==="POST"){
  await role("DEVELOPER");return respond(await command("RUN",await body(request,z.object({snapshotId:uuid,authorizationId:uuid,requestKey:uuid,invariants:z.array(z.object({id:uuid,version:z.number().int().positive()}).strict()).max(30).default([])}).strict())),202);
 }
 if(path[2]==="runs"&&path.length===5&&path[4]==="cancel"&&request.method==="POST"){
  await role("DEVELOPER");await body(request,z.object({}).strict());return respond(await command("CANCEL",{runId:uuid.parse(path[3])}),202);
 }
 if(path[2]==="runs"&&request.method==="GET"&&(path.length===4||path.length===5&&path[4]==="events")){
  const id=uuid.parse(path[3]);const events=path.length===5;
  const query=db.from(events?"lg_run_events":"lg_verification_runs").select("*").eq("project_id",projectId).eq(events?"run_id":"id",id).order(events?"id":"created_at").limit(100);
  const result=await query;databaseError(result.error);return respond(result.data);
 }
 throw new ApiError("INVALID_REQUEST");
}
