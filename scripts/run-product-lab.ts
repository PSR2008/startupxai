import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { ProductLabWorker, type ServiceCommand } from "../services/product-lab/worker";
import { LocalArtifacts } from "../services/orchestrator/artifacts";
async function main(){
 if(!["test","development"].includes(process.env.LAUNCHGATE_ENVIRONMENT??"")||process.env.LAUNCHGATE_REFERENCE_LAB_ENABLED!=="true")throw new Error("LOCAL_REFERENCE_LAB_NOT_ENABLED");
 const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!["127.0.0.1","localhost","[::1]"].includes(url.hostname)||!key)throw new Error("DEDICATED_LOCAL_DATABASE_REQUIRED");
 const db=createClient(url.href,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const command:ServiceCommand=async(name,action,data)=>{const result=await db.rpc(name,{p_action:action,p_data:data});if(result.error)throw new Error(`LOCAL_LAB_COMMAND_FAILED:${name}:${action}`);return result.data;};
 const worker=new ProductLabWorker(command,new LocalArtifacts(resolve(".launchgate/product-lab/artifacts")));let stopping=false;
 process.once("SIGINT",()=>{stopping=true;});process.once("SIGTERM",()=>{stopping=true;});
 do{await worker.tick();await worker.remediationTick();if(process.argv.includes("--once"))break;await new Promise(r=>setTimeout(r,1000));}while(!stopping);
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"LOCAL_LAB_FAILED");process.exitCode=1;});
