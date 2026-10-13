import { chromium,type Browser,type BrowserContext,type Page } from "playwright";
import { randomUUID } from "node:crypto";
import type { ExecutionGrant } from "@launchgate/contracts";
import type { TestPlan } from "../plans";
import { traceSchema,type RawTrace } from "../runner";
import { browserStateSchema,login,type Step } from "./contracts";
import type { BrowserRuntime } from "./fixture";
export function permittedBrowserUrl(input:string,origin:string){try{const u=new URL(input);return u.origin===origin&&u.protocol==="http:"&&u.hostname==="127.0.0.1"&&!u.username&&!u.password&&/^\/(control\/)?(login|signup|dashboard|paid|logout|edit|expire|server-error|quota|observe|health)$/.test(u.pathname)&&!u.search;}catch{return false;}}
export async function collectBrowser(plan:TestPlan,g:ExecutionGrant,runtime:BrowserRuntime,signal:AbortSignal,consume:()=>Promise<void>,approve:(t:RawTrace)=>Promise<boolean>,pace:()=>Promise<void>=()=>new Promise(r=>setTimeout(r,500))){
 const start=Date.now(),bounded=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(90000,g.exp*1000-Date.now())))]);
 const t:RawTrace={id:randomUUID(),initialHash:runtime.initialHash,mapping:runtime.mapping,health:false,positive:null,controlBefore:null,controlAfter:null,before:null,after:null,response:null,execution:"SETUP_FAILED",cleanup:false,requests:0,durationMs:0,completedAt:new Date().toISOString(),browser:{control:[],checks:[],state:null,urls:[],statuses:[],console:[],blocked:0,actions:0,runtimeMs:0,artifactBytes:0,realFinancialSpend:0,reason:"NONE"}};const b=t.browser!;let browser:Browser|undefined;const contexts:BrowserContext[]=[];const redirects=new Map<Page,string>();let queue=Promise.resolve();
 const charge=()=>{const next=queue.then(async()=>{bounded.throwIfAborted();await pace();await consume();t.requests++;});queue=next.catch(()=>{});return next;};
 const onAbort=()=>{void browser?.close().catch(()=>{});};bounded.addEventListener("abort",onAbort,{once:true});
 const context=async()=>{const ctx=await browser!.newContext({acceptDownloads:false,serviceWorkers:"block",javaScriptEnabled:false,viewport:{width:800,height:600}});contexts.push(ctx);
  await ctx.routeWebSocket("**/*",ws=>ws.close());
  await ctx.route("**/*",async route=>{try{const url=route.request().url();if(!permittedBrowserUrl(url,runtime.origin)){b.blocked++;return await route.abort();}await charge();
   // Fetch without automatic redirects; validate each Location before browser
   // navigation can follow it. No scope header is ever sent out of the fixture.
   const response=await route.fetch({headers:{...route.request().headers(),"x-launchgate-lab-scope":runtime.scopeKey},maxRedirects:0,timeout:5000});const location=response.headers().location;
   if(location&&!permittedBrowserUrl(new URL(location,url).href,runtime.origin)){b.blocked++;return await route.abort();}
   const body=await response.body();if(body.length>8192)throw new Error("RESPONSE_LIMIT");b.statuses.push(response.status());if(b.statuses.length>100)throw new Error("REQUEST_LIMIT");
   // Playwright does not reroute browser-followed redirect requests. Hand the
   // validated GET destination to the bounded interpreter instead; every hop
   // becomes a separately authorized, budgeted browser navigation.
   if(location){if(response.status()!==303)throw new Error("UNSUPPORTED_REDIRECT");redirects.set(route.request().frame().page(),new URL(location,url).href);await route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><title>Controlled redirect</title>"});}
   else await route.fulfill({response,body});
  }catch{await route.abort().catch(()=>{});}});return ctx;};
 const state=async(ctx:BrowserContext,prefix:string)=>{await charge();const r=await ctx.request.get(runtime.origin+prefix+"/observe",{headers:{"x-launchgate-lab-scope":runtime.scopeKey},maxRedirects:0,timeout:3000});if(r.status()!==200)throw new Error("OBSERVATION");return browserStateSchema.parse(await r.json());};
 const run=async(page:Page,steps:Step[],prefix:string)=>{const checks:boolean[]=[],deadline=Date.now()+plan.journey!.timeoutMs;page.setDefaultTimeout(1500);page.setDefaultNavigationTimeout(5000);page.on("console",m=>{if(b.console.length<10&&(m.type()==="error"||m.type()==="warning"))b.console.push(m.type()==="error"?"ERROR":"WARNING");});
  for(const step of steps){bounded.throwIfAborted();const remaining=deadline-Date.now();if(remaining<=0)throw new Error("JOURNEY_TIMEOUT");page.setDefaultTimeout(Math.min(1500,remaining));page.setDefaultNavigationTimeout(Math.min(5000,remaining));if(++b.actions>100)throw new Error("ACTION_LIMIT");const locator="target" in step?page.getByTestId(step.target):null;
   if(step.kind==="NAVIGATE"){await page.goto(runtime.origin+prefix+step.path,{waitUntil:"domcontentloaded"});b.urls.push(new URL(page.url()).pathname);}
   else if(step.kind==="FILL")await locator!.fill(step.value);
   else if(step.kind==="SUBMIT"||step.kind==="CLICK")await Promise.all([page.waitForNavigation({waitUntil:"domcontentloaded"}),locator!.click()]);
   else if(step.kind==="WAIT_FOR")await locator!.waitFor({state:"visible"});
   else if(step.kind==="ASSERT_VISIBLE")checks.push(await locator!.isVisible()===step.expected);
   else if(step.kind==="ASSERT_URL")checks.push(new URL(page.url()).pathname===prefix+step.path);
   else if(step.kind==="ASSERT_TEXT")checks.push(await locator!.isVisible()&&(await locator!.textContent())===step.value);
   else if(step.kind==="ASSERT_AUTH_STATE")checks.push((await state(page.context(),prefix)).authenticated===step.expected);
   for(let hops=0;redirects.has(page);hops++){if(hops>=3||++b.actions>100)throw new Error("REDIRECT_LIMIT");const next=redirects.get(page)!;redirects.delete(page);await page.goto(next,{waitUntil:"domcontentloaded"});b.urls.push(new URL(page.url()).pathname);}
  }return checks;};
 try{
  const env=Object.fromEntries(["SystemRoot","WINDIR","TEMP","TMP","PATH","HOME"].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
  browser=await chromium.launch({channel:"chromium",headless:true,env,timeout:15000,args:["--disable-background-networking","--disable-extensions"]});bounded.throwIfAborted();
  const control=await context(),page=await control.newPage();t.health=true;
  b.control=await run(page,[...login(),{kind:"ASSERT_VISIBLE",target:"dashboard",expected:true},{kind:"NAVIGATE",path:"/paid"},{kind:"ASSERT_VISIBLE",target:"paid",expected:true},{kind:"ASSERT_AUTH_STATE",expected:true}],"/control");t.positive={status:200,marker:null};if(!await approve(t)){b.reason="BROKEN_CONTROL";throw new Error("BROKEN_CONTROL");}
  const subject=await context(),subjectPage=await subject.newPage();
  if(runtime.fault==="CRASH"){await browser.close();throw new Error("BROWSER_CRASH");}if(runtime.fault==="TIMEOUT")await subjectPage.waitForURL(runtime.origin+"/never",{timeout:25});
  b.checks=await run(subjectPage,plan.journey!.steps,"");b.state=await state(subject,"");t.execution="COMPLETED";
 }catch{if(b.reason==="NONE")b.reason=b.blocked?"SAFETY_STOP":"BROWSER_FAILURE";t.execution=bounded.aborted?"TIMEOUT":"UNOBSERVABLE";}
 finally{bounded.removeEventListener("abort",onAbort);try{for(const ctx of contexts)await ctx.close();await browser?.close();await runtime.dispose();t.cleanup=true;}catch{await runtime.dispose().catch(()=>{});}b.runtimeMs=Date.now()-start;t.durationMs=b.runtimeMs;t.completedAt=new Date().toISOString();b.artifactBytes=Buffer.byteLength(JSON.stringify(b));}
 return traceSchema.parse(t);
}
