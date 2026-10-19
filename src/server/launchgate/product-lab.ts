import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader, databaseError } from "./database";
import { requireOrganizationRole, requireProjectAccess } from "./authorization";
import { ApiError } from "../http/api-error";
import { productLabCatalog } from "../../../services/product-lab/catalog";
import { invariantSetDigest } from "../../../services/releases/engine";
import { boundedBody } from "../github/provider";
const columns="project_id,organization_id,invariant_id,adjacent_id,policy_id,created_by,created_at,state,release_id";
export async function productLabRoute(request:Request,session:{principal:VerifiedPrincipal;db:SupabaseClient},path:string[],correlationId:string){
 if(!["development","test"].includes(process.env.LAUNCHGATE_ENVIRONMENT??"")||process.env.LAUNCHGATE_REFERENCE_LAB_ENABLED!=="true")throw new ApiError("CONFIGURATION_UNAVAILABLE");
 const {db,principal}=session,reader=authorizationReader(db);const id=z.string().uuid().parse(path[1]);
 const project=path[0]==="projects"?await requireProjectAccess(reader,principal,id):null;const org=project?.organizationId??id;
 await requireOrganizationRole(reader,principal,org,request.method==="GET"?"VIEWER":"ADMIN");
 const result=(data:unknown)=>Response.json({ok:true,data,correlationId},{headers:{"Cache-Control":"no-store"}});
 if(path.length!==3)throw new ApiError("INVALID_REQUEST");
 if(request.method==="GET"){
  let query=db.from("lg_product_labs").select(columns).eq("organization_id",org);if(project)query=query.eq("project_id",id);
  const r=await query.order("created_at",{ascending:false}).limit(50);databaseError(r.error);return result(r.data);
 }
 if(request.method!=="POST"||!request.headers.get("content-type")?.startsWith("application/json"))throw new ApiError("INVALID_REQUEST");
 let input;try{input=z.object({action:z.enum(["CREATE","CONFIRM","RUN"])}).strict().parse(JSON.parse(Buffer.from(await boundedBody(new Response(request.body),1024)).toString()));}catch{throw new ApiError("INVALID_REQUEST");}
 if((input.action==="CREATE")===!!project)throw new ApiError("INVALID_REQUEST");
 let policyData=null;
 if(input.action==="CONFIRM"){
  const r=await db.from("lg_product_labs").select(columns).eq("project_id",id).eq("organization_id",org).single();databaseError(r.error);
  const row=z.object({invariant_id:z.string().uuid(),adjacent_id:z.string().uuid(),policy_id:z.string().uuid()}).parse(r.data);
  const {policy}=productLabCatalog(row);policyData={name:"Reference Lab tenant isolation",policy,invariantSetDigest:invariantSetDigest(policy)};
 }
 const r=await db.rpc("lg_product_lab_command",{p_organization:org,p_project:project?id:null,p_action:input.action,p_policy:policyData,p_correlation:correlationId});databaseError(r.error);return result(r.data);
}
