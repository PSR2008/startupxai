// Controlled negative fixture: observability remains available while every
// business operation returns 403. Never used by the production runtime factory.
import { createServer } from "node:http";
import type { LabRuntime } from "../../reference-lab/runtime";
export async function rejectAllBusinessOperations(runtime: LabRuntime): Promise<LabRuntime> {
  const origin=new URL(runtime.origin);if(origin.hostname!=="127.0.0.1"||origin.protocol!=="http:")throw new Error("LOCAL_FIXTURE_REQUIRED");
  const server=createServer(async(req,res)=>{
    const path=req.url??"";
    if(path!=="/health"&&!/^\/observe\/[a-z_]+$/.test(path)){res.writeHead(403,{"content-type":"application/json"});res.end("{}");return;}
    try{const r=await fetch(runtime.origin+path,{headers:{"x-launchgate-lab-scope":runtime.scopeKey},redirect:"error",signal:AbortSignal.timeout(2000)});res.writeHead(r.status,{"content-type":"application/json"});res.end(await r.text());}catch{res.writeHead(503);res.end();}
  });
  try{await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});}
  catch(error){await runtime.dispose();throw error;}
  let disposed=false;
  return {...runtime,origin:`http://127.0.0.1:${(server.address() as {port:number}).port}`,async dispose(){if(disposed)return;disposed=true;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();}};
}
