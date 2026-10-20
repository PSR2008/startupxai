import "server-only";
import { randomBytes,randomUUID } from "node:crypto";
import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hash,redact,safePath } from "@launchgate/source-analysis";
import { type VerifiedPrincipal } from "../auth/principal";
import { authorizationReader,databaseError } from "../launchgate/database";
import { requireProjectAccess,requireOrganizationRole } from "../launchgate/authorization";
import { ApiError } from "../http/api-error";
import { GitHubProvider,boundedBody } from "./provider";
import { githubConfiguration } from "./config";
import { sourceStore } from "./store";

const uuid=z.string().uuid();const positive=z.number().int().positive().safe();
const snapshotColumns="id,organization_id,project_id,connection_id,commit_sha,tree_sha,requested_by,analysis_version,state,source_state,failure_code,created_at,updated_at";
async function json<T>(request:Request,schema:z.ZodType<T>) {
 if(!request.headers.get("content-type")?.startsWith("application/json"))throw new ApiError("INVALID_REQUEST");
 try{return schema.parse(JSON.parse(Buffer.from(await boundedBody(new Response(request.body),16384)).toString("utf8")));}catch{throw new ApiError("INVALID_REQUEST");}
}
export async function sourceRoute(request:Request,session:{principal:VerifiedPrincipal;db:SupabaseClient},path:string[],correlationId=randomUUID()):Promise<Response> {
 const {principal,db}=session;const projectId=uuid.parse(path[1]);
 const reader=authorizationReader(db);const context=await requireProjectAccess(reader,principal,projectId);
 const respond=(data:unknown,status=200)=>Response.json({ok:true,data,correlationId},{status,headers:{"Cache-Control":"no-store","X-Correlation-ID":correlationId}});
 const role=async(minimum:"ADMIN"|"DEVELOPER")=>requireOrganizationRole(reader,principal,context.organizationId,minimum);
 const rpc=async(name:string,args:Record<string,unknown>)=>{const {data,error}=await db.rpc(name,args);databaseError(error);return data;};
 if(path[2]==="github") {
  if(path.length===4&&path[3]==="onboarding"&&request.method==="GET") {
   await role('ADMIN');return respond({installUrl:await new GitHubProvider(githubConfiguration()).installUrl()});
  }
  if(path.length===4&&path[3]==="discover"&&request.method==="POST") {
   await role('ADMIN');const input=await json(request,z.object({state:z.string().regex(/^[a-f0-9]{64}$/),code:z.string().min(1).max(512)}).strict());
   const setup=z.object({project_id:uuid,installation_id:positive,repository_id:positive}).parse(await sourceStore().command('READ_SETUP',{stateHash:hash(input.state),actorId:principal.userId}));
   if(setup.project_id!==projectId||setup.installation_id!==1||setup.repository_id!==1)throw new ApiError('ACCESS_DENIED');
   return respond(await new GitHubProvider(githubConfiguration()).discoverRepositories(input.code));
  }
  if(path.length===4&&path[3]==="setup"&&request.method==="POST") {
   await role("ADMIN");const input=await json(request,z.object({installationId:positive,repositoryId:positive,applicationRoot:z.string().max(240).default("").refine(p=>!p||safePath(p))}).strict());
   const provider=new GitHubProvider(githubConfiguration());const state=randomBytes(32).toString("hex");
   await rpc("lg_github_setup",{p_project:projectId,p_state_hash:hash(state),p_installation:input.installationId,p_repository:input.repositoryId,p_root:input.applicationRoot,p_correlation:correlationId});
   return respond({authorizationUrl:provider.authorizationUrl(state),state,expiresInSeconds:600},201);
  }
  if(path.length===4&&path[3]==="connections"&&request.method==="POST") {
   await role("ADMIN");const input=await json(request,z.object({state:z.string().regex(/^[a-f0-9]{64}$/),code:z.string().min(1).max(512)}).strict());
   const store=sourceStore();const data={stateHash:hash(input.state),actorId:principal.userId};
   const setup=z.object({project_id:uuid,installation_id:positive,repository_id:positive}).parse(await store.command("READ_SETUP",data));
   if(setup.project_id!==projectId)throw new ApiError("ACCESS_DENIED");
   const verified=await new GitHubProvider(githubConfiguration()).verifyConnection(input.code,setup.installation_id,setup.repository_id);
   return respond(await store.command("BIND",{...data,...verified,correlationId}),201);
  }
  if(path.length===4&&path[3]==="repositories"&&request.method==="GET") {
   await role("ADMIN");const {data,error}=await db.from("lg_installation_repositories").select("*").eq("organization_id",context.organizationId).order("id").limit(100);databaseError(error);return respond(data);
  }
  if(path.length===4&&path[3]==="connections"&&request.method==="GET") {
   const {data,error}=await db.from("lg_repository_connections").select("*").eq("organization_id",context.organizationId).eq("project_id",projectId).order("id").limit(100);databaseError(error);return respond(data);
  }
  if(path.length===5&&path[3]==="connections"&&request.method==="DELETE") {
   await role("ADMIN");await rpc("lg_disconnect_repository",{p_project:projectId,p_connection:uuid.parse(path[4]),p_correlation:correlationId});return respond({disconnected:true});
  }
 }
 if(path.length===5&&path[2]==="repositories"&&path[4]==="snapshots"&&request.method==="POST") {
  await role("DEVELOPER");const input=await json(request,z.object({commitSha:z.string().regex(/^[a-f0-9]{40}$/)}).strict());
  const id=await rpc("lg_request_snapshot",{p_project:projectId,p_connection:uuid.parse(path[3]),p_sha:input.commitSha,p_correlation:correlationId});return respond({snapshotId:id,state:"REQUEST_ACCEPTED"},202);
 }
 if(path[2]==="snapshots"&&path.length>=4) {
  const snapshotId=uuid.parse(path[3]);
  const {data,error}=await db.from("lg_repository_snapshots").select(snapshotColumns).eq("organization_id",context.organizationId).eq("project_id",projectId).eq("id",snapshotId).maybeSingle();databaseError(error);if(!data)throw new ApiError("ACCESS_DENIED");
  if(path.length===4&&request.method==="GET")return respond(data);
  if(path.length===5&&path[4]==="analyze"&&request.method==="POST") {
   await role("DEVELOPER");await json(request,z.object({}).strict());await rpc("lg_retry_snapshot",{p_project:projectId,p_snapshot:snapshotId,p_correlation:correlationId});return respond({snapshotId,state:"REQUEST_ACCEPTED",scheduling:"EXTERNAL_WORKER_REQUIRED"},202);
  }
  if(path.length===5&&request.method==="GET"&&["architecture","invariant-proposals"].includes(path[4])) {
   const table=path[4]==="architecture"?"lg_architecture_snapshots":"lg_invariant_proposals";
   const result=await db.from(table).select("*").eq("organization_id",context.organizationId).eq("project_id",projectId).eq("snapshot_id",snapshotId).limit(100);databaseError(result.error);return respond(result.data);
  }
 }
 if(path.length===5&&path[2]==="invariant-proposals"&&path[4]==="confirm"&&request.method==="POST") {
  await role("ADMIN");const input=await json(request,z.object({action:z.enum(["CONFIRM","REFINE","REJECT","DEFER"]),statement:z.string().trim().min(1).max(2000),requestKey:uuid}).strict());
  if(redact(input.statement)!==input.statement)throw new ApiError("INVALID_REQUEST");
  return respond(await rpc("lg_review_invariant",{p_project:projectId,p_proposal:uuid.parse(path[3]),p_action:input.action,p_statement:input.statement,p_request_key:input.requestKey,p_correlation:correlationId}),201);
 }
 if(path.length===5&&path[2]==="invariant-proposals"&&path[4]==="confirmations"&&request.method==="GET") {
  const {data,error}=await db.from("lg_invariant_confirmations").select("*").eq("organization_id",context.organizationId).eq("project_id",projectId).eq("proposal_id",uuid.parse(path[3])).order("version").limit(100);databaseError(error);return respond(data);
 }
 throw new ApiError("INVALID_REQUEST");
}
