import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader,databaseError } from "../launchgate/database";
import { requireProjectAccess,requireOrganizationRole } from "../launchgate/authorization";
import { ApiError } from "../http/api-error";
import { boundedBody } from "../github/provider";
export async function findingRoute(request:Request,session:{principal:VerifiedPrincipal;db:SupabaseClient},path:string[],correlationId:string){
 const {principal,db}=session,projectId=z.string().uuid().parse(path[1]);const reader=authorizationReader(db);
 const access=await requireProjectAccess(reader,principal,projectId);
 const respond=(data:unknown,status=200)=>Response.json({ok:true,data,correlationId},{status,headers:{"Cache-Control":"no-store","X-Correlation-ID":correlationId}});
 if(path[2]==="runs"&&path.length===5&&path[4]==="findings"&&request.method==="GET"){
  const r=await db.from("lg_finding_occurrences").select("*").eq("project_id",projectId).eq("run_id",z.string().uuid().parse(path[3])).limit(100);databaseError(r.error);return respond(r.data);
 }
 if(path[2]==="findings"&&path.length>=4){
  const findingId=z.string().uuid().parse(path[3]);
  const f=await db.from("lg_findings").select("*").eq("project_id",projectId).eq("id",findingId).maybeSingle();databaseError(f.error);if(!f.data)throw new ApiError("ACCESS_DENIED");
  if(path.length===4&&request.method==="GET")return respond(f.data);
  if(path.length===5&&path[4]==="replay"&&request.method==="POST"){
   await requireOrganizationRole(reader,principal,access.organizationId,"ADMIN");
   let input;try{if(!request.headers.get("content-type")?.startsWith("application/json"))throw new Error();input=z.object({variant:z.enum(["fixed","vulnerable","inconclusive"]),requestKey:z.string().uuid()}).strict().parse(JSON.parse(Buffer.from(await boundedBody(new Response(request.body),2048)).toString()));}catch{throw new ApiError("INVALID_REQUEST");}
   const r=await db.rpc("lg_finding_replay",{p_project:projectId,p_finding:findingId,p_variant:input.variant,p_request_key:input.requestKey,p_correlation:correlationId});databaseError(r.error);return respond({runId:r.data},202);
  }
  if(path.length===5&&path[4]==="regressions"&&request.method==="GET"){
   const r=await db.from("lg_regression_tests").select("*").eq("project_id",projectId).eq("finding_id",findingId).limit(100);databaseError(r.error);return respond(r.data);
  }
  if(path.length===5&&path[4]==="reproduction-bundles"&&request.method==="GET"){
   const o=await db.from("lg_finding_occurrences").select("run_id").eq("project_id",projectId).eq("finding_id",findingId).limit(100);databaseError(o.error);
   const r=await db.from("lg_reproduction_bundles").select("run_id,attempt_id,manifest_digest").eq("project_id",projectId).in("run_id",(o.data??[]).map(x=>x.run_id)).limit(100);databaseError(r.error);return respond(r.data);
  }
 }
 throw new ApiError("INVALID_REQUEST");
}
