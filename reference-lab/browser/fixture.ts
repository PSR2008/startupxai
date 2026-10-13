import { createServer } from "node:http";
import { randomUUID,randomBytes } from "node:crypto";
import { digest,canonical } from "../../services/runner/metadata";
import type { TestPlan,Variant } from "../plans";
import type { BrowserFault } from "./contracts";
let active=0;export const activeBrowserFixtures=()=>active;
export async function startBrowserFixture(plan:TestPlan,variant:Variant,fault:BrowserFault="NONE"){
 const key=randomBytes(32).toString("hex"),sessions=new Map<string,{paid:boolean;control:boolean}>();const state={control:{record:"",successes:0,paidAccess:false,providerCalls:0},subject:{record:"",successes:0,paidAccess:false,providerCalls:0}};
 const server=createServer(async(req,res)=>{const url=new URL(req.url!,"http://local"),control=url.pathname.startsWith("/control/"),path=url.pathname.replace(/^\/control/,"");const bad=variant==="vulnerable"&&!control,s=control?state.control:state.subject;
  const html=(code:number,body:string)=>{res.writeHead(code,{"content-type":"text/html","content-security-policy":"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'","cache-control":"no-store"});res.end(`<!doctype html><title>Reference Lab</title>${body}`);};
  if(req.headers["x-launchgate-lab-scope"]!==key)return html(403,"");
  const sessionId=(req.headers.cookie??"").split(";").map(x=>x.trim()).find(x=>x.startsWith("session="))?.slice(8),session=sessionId?sessions.get(sessionId):undefined,authenticated=!!session&&session.control===control;
  const marker=(name:string,text=name)=>`<div data-testid="${name}">${text}</div>`;const prefix=control?"/control":"";
  if(path==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end('{"healthy":true}');}
  if(path==="/observe"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({...s,authenticated}));}
  if(fault==="BROKEN"||variant==="inconclusive")return html(503,marker("error"));
  let body="";for await(const chunk of req){body+=chunk.toString();if(body.length>2048)return html(413,marker("error"));}const form=new URLSearchParams(body);
  if(path==="/login"||path==="/signup"){
   if(req.method==="POST"){
    if(form.get("password")!=="synthetic-password"&&!bad)return html(401,marker("error"));
    const id=randomUUID();sessions.set(id,{paid:form.get("username")==="paid",control});res.setHeader("set-cookie",`session=${id}; HttpOnly; SameSite=Strict; Path=/`);
    if(bad&&["browser.login","browser.signup","browser.release"].includes(plan.caseId)){res.writeHead(303,{location:prefix+"/paid"});return res.end();}
    if(fault==="ESCAPE"&&!control){res.writeHead(303,{location:"http://127.0.0.1:1/forbidden"});return res.end();}
    res.writeHead(303,{location:prefix+"/dashboard"});return res.end();
   }
   return html(200,`<form method="post" action="${prefix+path}"><input data-testid="username" name="username"><input data-testid="password" name="password" type="password"><button data-testid="submit">Sign in</button></form>`);
  }
  if(path==="/logout"||path==="/expire"){if(!bad&&sessionId)sessions.delete(sessionId);return html(200,marker("success"));}
  if(!authenticated&&!bad)return html(403,marker("denied"));
  if(path==="/dashboard")return html(200,marker("dashboard",fault==="COPY"?"Welcome to the new dashboard":"Dashboard"));
  if(path==="/paid"){if(!session?.paid&&!bad)return html(403,marker("denied"));s.paidAccess=true;return html(200,marker("paid"));}
  if(path==="/edit"){
   if(req.method==="POST"){const value=form.get("value");if(!["created","updated"].includes(value??"")&&!bad)return html(422,marker("error"));if(!bad)s.record=value!;s.successes++;return html(200,marker("success")+marker("record",s.record));}
   return html(200,'<form method="post"><input data-testid="value" name="value"><button data-testid="save">Save</button></form>');
  }
  if(path==="/quota"){if(bad){s.providerCalls++;s.successes++;}return html(429,marker(bad?"success":"denied"));}
  if(path==="/server-error"){if(bad)s.successes++;return html(500,marker(bad?"success":"error"));}
  return html(404,marker("error"));
 });await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));active++;let disposed=false;
 const subject=randomUUID();return {origin:`http://127.0.0.1:${(server.address() as {port:number}).port}`,scopeKey:key,fault,initialHash:digest(canonical({seed:plan.seed,journey:plan.journey,state})),mapping:{identities:{subject,tenant_a_member:subject},resources:{journey_subject:randomUUID()}},async dispose(){if(disposed)return;disposed=true;sessions.clear();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));active--;}};
}
export type BrowserRuntime=Awaited<ReturnType<typeof startBrowserFixture>>;
