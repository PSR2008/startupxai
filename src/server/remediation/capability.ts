import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader, databaseError } from "../launchgate/database";
import { requireProjectAccess, requireOrganizationRole } from "../launchgate/authorization";
import { boundedBody } from "../github/provider";
import { remediationConfiguration, verifyRemediationInstallation } from "../github/remediation";
import { remediationStore } from "./store";
import { ApiError } from "../http/api-error";
export async function capabilityRoute(request:Request,session:{principal:VerifiedPrincipal;db:SupabaseClient},path:string[],correlationId:string) {
  const projectId=z.string().uuid().parse(path[1]),reader=authorizationReader(session.db),access=await requireProjectAccess(reader,session.principal,projectId);
  await requireOrganizationRole(reader,session.principal,access.organizationId,"ADMIN");
  if(request.method!=="POST"||!request.headers.get("content-type")?.startsWith("application/json"))throw new ApiError("INVALID_REQUEST");
  let body:unknown;try{body=JSON.parse(Buffer.from(await boundedBody(new Response(request.body),4096)).toString("utf8"));}catch{throw new ApiError("INVALID_REQUEST");}
  let data:unknown;
  if(path.length===5&&path[4]==="revoke"){
    z.object({}).strict().parse(body);const result=await session.db.rpc("lg_fix_capability_revoke",{p_project:projectId,p_id:z.string().uuid().parse(path[3]),p_correlation:correlationId});databaseError(result.error);data={revoked:true};
  }else if(path.length===3){
    const input=z.object({connectionId:z.string().uuid(),installationId:z.number().int().positive().safe()}).strict().parse(body),store=remediationStore();
    const binding={projectId,connectionId:input.connectionId,actorId:session.principal.userId};
    const scope=z.object({repositoryId:z.number().int().positive(),analysisAppId:z.number().int().positive()}).parse(await store.command("CAPABILITY_CONTEXT",binding));
    const config=remediationConfiguration();if(config.appId===scope.analysisAppId)throw new ApiError("ACCESS_DENIED");
    const verified=await verifyRemediationInstallation(config,input.installationId,scope.repositoryId);
    data=await store.command("CAPABILITY_VERIFIED",{...binding,...verified});
  }else throw new ApiError("INVALID_REQUEST");
  return Response.json({ok:true,data,correlationId},{headers:{"Cache-Control":"no-store"}});
}
