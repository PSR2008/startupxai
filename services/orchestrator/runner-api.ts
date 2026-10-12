import type { KeyObject } from "node:crypto";
import { verifyGrant } from "../runner/grant";
import { admitEvidence,authority } from "./evidence";
import type { ExecutionStore } from "./store";
import type { ArtifactStore } from "./artifacts";

// Separate service handler, NOT mounted under browser Next.js API authority.
// Host behind TLS/private ingress. Signed per-attempt capabilities are mandatory.
export function runnerHandler(key:KeyObject,store:ExecutionStore,artifacts:ArtifactStore) {
 return async(request:Request):Promise<Response>=>{
  try {
   if(request.method!=="POST"||!request.headers.get("content-type")?.startsWith("application/json"))throw new Error("DENIED");
   const bearer=request.headers.get("authorization");if(!bearer?.startsWith("Bearer "))throw new Error("DENIED");
   const g=verifyGrant(bearer.slice(7),key);const path=new URL(request.url).pathname;
   if(!["/internal/runner/start","/internal/runner/check","/internal/runner/request","/internal/runner/evidence","/internal/runner/fail"].includes(path))throw new Error("DENIED");
   const reader=request.body?.getReader();if(!reader)throw new Error("DENIED");let size=0;const chunks:Uint8Array[]=[];
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>6*1048576){await reader.cancel();throw new Error("LIMIT");}chunks.push(part.value);}}finally{reader.releaseLock();}
   const input=JSON.parse(Buffer.concat(chunks).toString("utf8"));
   if(path.endsWith("/evidence"))return Response.json(await admitEvidence(g,input,store,artifacts),{headers:{"Cache-Control":"no-store"}});
   if(!input||Object.keys(input).length)throw new Error("DENIED");
   const action=path.split("/").at(-1)!.toUpperCase();await store.command(action,authority(g));
   return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({ok:false,code:"RUNNER_AUTHORITY_DENIED"},{status:403,headers:{"Cache-Control":"no-store"}});}
 };
}
