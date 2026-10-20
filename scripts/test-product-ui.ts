import { distributionDemo } from "./distribution-demo";
import assert from "node:assert/strict";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { ProductLabWorker, type ServiceCommand } from "../services/product-lab/worker";
import { LocalArtifacts } from "../services/orchestrator/artifacts";

async function main(){
// Real disposable PostgreSQL/PostgREST, real Next routes and signed test principal.
// This identity provider exists only in this test process; no application bypass.
const docker=(args:string[],input?:string)=>{const r=spawnSync("docker",args,{input,encoding:"utf8",timeout:120000,windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const name=`launchgate-product-ui-${randomUUID()}`,restName=`${name}-rest`,owner=randomUUID(),secret=randomUUID()+randomUUID();
const password=randomUUID(),email="owner@reference-lab.invalid",viewer=randomUUID(),viewerEmail="viewer@reference-lab.invalid";
const token=(role:string,sub?:string)=>{const unsigned=[{alg:"HS256",typ:"JWT"},{role,sub,exp:Math.floor(Date.now()/1000)+7200}].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");return `${unsigned}.${createHmac("sha256",secret).update(unsigned).digest("base64url")}`;};
const accessToken=token("authenticated",owner),viewerToken=token("authenticated",viewer),anon=token("anon"),service=token("service_role");
const user={id:owner,aud:"authenticated",role:"authenticated",email,email_confirmed_at:new Date().toISOString(),app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:new Date().toISOString()};
let pg=false,rest=false,browser:Browser|undefined,next:ChildProcess|undefined,artifactRoot="";
const output=resolve(process.env.LAUNCHGATE_DISTRIBUTION_DEMO==="1"?".launchgate/phase12-qa":".launchgate/phase11-qa");await mkdir(output,{recursive:true});
const sql=(statement:string)=>docker(["exec","-i",name,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","launchgate_test"],statement);
let restUrl="";
const gateway=createServer(async(req,res)=>{
 res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","authorization,apikey,content-type,x-client-info,x-supabase-api-version");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
 if(req.method==="OPTIONS"){res.writeHead(204).end();return;}
 const json=(value:unknown,status=200)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(value));};
 try{
  if(req.url?.startsWith("/auth/v1/token")){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=JSON.parse(Buffer.concat(chunks).toString());if(![email,viewerEmail].includes(body.email)||body.password!==password){json({error:"invalid_grant"},400);return;}const isViewer=body.email===viewerEmail;json({access_token:isViewer?viewerToken:accessToken,token_type:"bearer",expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,refresh_token:randomUUID(),user:isViewer?{...user,id:viewer,email:viewerEmail}:user});return;}
  if(req.url==="/auth/v1/user"){const supplied=(req.headers.authorization??"").replace(/^Bearer /,"");const isViewer=supplied===viewerToken;const a=Buffer.from(supplied),b=Buffer.from(isViewer?viewerToken:accessToken);if(a.length!==b.length||!timingSafeEqual(a,b)){json({error:"invalid_token"},401);return;}json(isViewer?{...user,id:viewer,email:viewerEmail}:user);return;}
  if(req.url?.startsWith("/auth/v1/logout")){json({});return;}
  if(req.url?.startsWith("/rest/v1/")){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const headers=new Headers();for(const key of ["authorization","content-type","accept","prefer","range","range-unit"]){const v=req.headers[key];if(typeof v==="string")headers.set(key,v);}const response=await fetch(`${restUrl}/${req.url.slice(9)}`,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});res.writeHead(response.status,{"Content-Type":response.headers.get("content-type")??"application/json"});res.end(Buffer.from(await response.arrayBuffer()));return;}
  json({error:"not_found"},404);
 }catch{json({error:"test_gateway_error"},500);}
});
const listen=()=>new Promise<number>(resolvePort=>gateway.listen(0,"127.0.0.1",()=>resolvePort((gateway.address() as {port:number}).port)));
const command:ServiceCommand=async(name,action,data)=>{const r=await fetch(`${restUrl}/rpc/${name}`,{method:"POST",headers:{Authorization:`Bearer ${service}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_data:data})});const body=await r.json();if(!r.ok)throw new Error(`${name}/${action}: ${JSON.stringify(body)}`);return body;};
async function waitFor(url:string){for(let i=0;i<120;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error(`Server not ready: ${url}`);}
async function screenshot(page:Page,label:string){for(const width of [1440,1280,768,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(output,`${label}-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label} overflows at ${width}`);}await page.setViewportSize({width:1440,height:1000});}
async function submit(page:Page,label:string){const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==="POST"&&r.url().includes("/api/v1/")),page.getByRole("button",{name:label,exact:true}).click()]);assert.ok(response.ok(),`${label}: HTTP ${response.status()}`);}
try{
 docker(["run","-d","--name",name,"--label","launchgate.disposable=true","--label","launchgate.phase=11","-p","127.0.0.1::3000","-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_DB=launchgate_test","postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24"]);pg=true;
 for(let i=0;i<60;i++){const r=spawnSync("docker",["exec",name,"pg_isready","-h","127.0.0.1","-U","postgres"],{windowsHide:true});if(r.status===0)break;await new Promise(r=>setTimeout(r,250));}
 sql(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator LOGIN NOINHERIT;GRANT anon,authenticated,service_role TO authenticator;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
 for(const file of (await readdir("migrations")).filter(x=>/^\d+.*\.sql$/.test(x)).sort())sql(await readFile(`migrations/${file}`,"utf8"));sql(`INSERT INTO auth.users VALUES('${owner}');`);
 docker(["run","-d","--name",restName,"--label","launchgate.disposable=true","--label","launchgate.phase=11","--network",`container:${name}`,"-e","PGRST_DB_URI=postgresql://authenticator@127.0.0.1:5432/launchgate_test","-e","PGRST_DB_SCHEMAS=public","-e","PGRST_DB_ANON_ROLE=anon","-e",`PGRST_JWT_SECRET=${secret}`,"postgrest/postgrest:v12.2.3@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401"]);rest=true;
 restUrl=`http://${docker(["port",name,"3000/tcp"])}`;await waitFor(restUrl);const authPort=await listen();
 const port=String(34000+Math.floor(Math.random()*10000)),base=`http://127.0.0.1:${port}`;
 // Serve deployable immutable artifacts. The Windows dev server returned framework
 // JSON parse failures during navigation; acceptance does not depend on hot compilation.
 const nextEnvironment={...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${authPort}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,LAUNCHGATE_ENVIRONMENT:"test",LAUNCHGATE_REFERENCE_LAB_ENABLED:"true"};
 const buildLog=createWriteStream(join(output,"build.log"));
 next=spawn(process.execPath,["node_modules/next/dist/bin/next","build"],{windowsHide:true,detached:process.platform!=="win32",env:nextEnvironment,stdio:["ignore","pipe","pipe"]});
 next.stdout?.pipe(buildLog,{end:false});next.stderr?.pipe(buildLog,{end:false});
 await new Promise<void>((resolveBuild,rejectBuild)=>{next!.once("error",rejectBuild);next!.once("exit",code=>code===0?resolveBuild():rejectBuild(new Error(`Browser fixture production build failed (${code}); inspect build.log`)));});buildLog.end();
 next=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",port],{windowsHide:true,detached:process.platform!=="win32",env:nextEnvironment,stdio:["ignore","pipe","pipe"]});const log=createWriteStream(join(output,"next.log"));next.stdout?.pipe(log);next.stderr?.pipe(log);await waitFor(base);
 artifactRoot=await mkdtemp(join(tmpdir(),"launchgate-phase11-artifacts-"));const worker=new ProductLabWorker(command,new LocalArtifacts(artifactRoot));
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);page.on("pageerror",e=>console.log("PAGE_ERROR",e.message));page.on("console",m=>{if(m.type()==="error")console.log("BROWSER_ERROR",m.text());});
 await page.goto(base);await page.getByRole("heading",{level:1}).waitFor();await screenshot(page,"landing");
 await page.getByRole("link",{name:"Connect GitHub"}).first().click();await page.waitForURL("**/app/login");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL("**/app");
 await page.getByRole("link",{name:"New project"}).click();await page.waitForURL("**/app/onboarding?new=1");await page.getByLabel("Organization name").fill("Phase 11 controlled organization");await page.getByRole("button",{name:"Create organization"}).click();await page.getByLabel("Project name").waitFor();await screenshot(page,"onboarding");await page.getByLabel("Project name").fill("Customer project");await page.getByRole("button",{name:"Create project",exact:true}).click();await page.waitForURL("**/setup");
 await page.goto(`${base}/app/reference-lab`);await page.getByRole("button",{name:"Create isolated Reference Lab"}).click();await page.waitForURL("**/lab");const labProject=page.url().split("/").at(-2)!;
 await page.getByRole("button",{name:"Confirm invariant & policy"}).click();await page.getByRole("button",{name:"Run Reference Lab verification"}).click();await page.getByText("Verification is queued",{exact:false}).waitFor();console.log("UI: onboarding and durable invariant/policy confirmation passed");
 await worker.tick();await page.getByRole("button",{name:"Refresh execution state"}).click();await page.getByRole("link",{name:"Review release decision"}).click();await page.getByRole("heading",{name:"Release blocked",exact:true}).waitFor();await screenshot(page,"release");console.log("UI: actual reproduced failure and BLOCK gate passed");
 await page.goto(`${base}/app/projects/${labProject}`);await page.getByRole("heading",{name:"Release blocked",exact:true}).waitFor();await screenshot(page,"project");await page.getByRole("link",{name:/Members of one organization/}).first().click();await page.getByRole("heading",{name:"What failed"}).waitFor();await screenshot(page,"finding");
 await submit(page,"Generate fix proposal");await worker.remediationTick();await page.reload();await page.getByRole("link",{name:"Inspect proposed fix"}).click();await page.getByRole("button",{name:"Validate proposal"}).waitFor();await screenshot(page,"remediation");await submit(page,"Validate proposal");await worker.remediationTick();await page.getByRole("button",{name:"Refresh state"}).click();await submit(page,"Create PR");await worker.remediationTick();await page.getByRole("button",{name:"Refresh state"}).click();await submit(page,"Verify fix");await worker.remediationTick();await page.getByRole("button",{name:"Refresh state"}).click();await page.getByRole("heading",{name:"Fix verified",exact:true}).waitFor();await page.getByRole("link",{name:"Inspect verification release"}).click();await page.getByRole("heading",{name:"Ready for release",exact:true}).waitFor();console.log("UI: proposal → validation → explicit PR → verified replay → SHIP passed");
 if(process.env.LAUNCHGATE_DISTRIBUTION_DEMO==="1"){const response=await fetch(`${base}/api/v1/projects/${labProject}`,{headers:{Authorization:`Bearer ${accessToken}`}});const project=(await response.json()).data;await distributionDemo({base,accessToken,owner,organizationId:project.organization_id,artifacts:artifactRoot,command,page});}
 await page.goto(`${base}/app/integrations`);await page.getByRole("heading",{name:"Integration readiness"}).waitFor();await page.getByRole("heading",{name:"Production Sandbox",exact:true}).waitFor();await screenshot(page,"integrations");assert.equal(sql("SELECT coalesce(sum(active),0)||':'||coalesce(sum(reserved),0) FROM lg_execution_budgets"),"0:0");assert.equal(sql("SELECT count(*) FROM lg_operational_resources WHERE kind='CREDENTIAL' AND state<>'DESTROYED'"),"0");
 assert.equal(await page.locator(".lg-status").filter({hasText:/UNVERIFIED/}).count(),7);await page.locator(".lg-status").filter({hasText:/BLOCKED BY ENVIRONMENT/}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Menu",exact:true}).click();assert.equal(await page.getByRole("button",{name:"Menu",exact:true}).getAttribute("aria-expanded"),"true");await page.getByRole("navigation",{name:"Workspace",exact:true}).getByRole("link",{name:"Projects",exact:true}).click();await page.getByRole("heading",{name:"Projects",exact:true}).waitFor();assert.equal(await page.getByText("Reference Lab · Tenant isolation",{exact:true}).count(),0);
 await page.goto(`${base}/app/projects/${labProject}/settings`);const danger=page.getByRole("button",{name:"Request organization deletion",exact:true});await danger.click();const dialog=page.getByRole("dialog");await dialog.waitFor();assert.equal(await dialog.getByRole("button",{name:"Keep current settings"}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press("Tab");assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);assert.equal(await danger.evaluate(e=>e===document.activeElement),true);
 assert.ok(!(await page.content()).includes(service),"service credential must never reach HTML");const unauthorized=await page.request.get(`${base}/api/v1/organizations`);assert.equal(unauthorized.status(),401);
 await page.getByRole("button",{name:"Menu",exact:true}).click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await page.waitForURL("**/app/login");await page.goto(`${base}/app/projects/${labProject}`);await page.waitForURL("**/app/login");
 console.log("UI: mobile navigation, lab isolation, dialog focus/Escape, secret exclusion and signed-out route protection passed");
 sql(`INSERT INTO auth.users VALUES('${viewer}');INSERT INTO lg_organization_memberships(organization_id,user_id,role) SELECT organization_id,'${viewer}','VIEWER' FROM lg_projects WHERE id='${labProject}';`);
 await page.getByLabel("Email").fill(viewerEmail);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL("**/app");
 await page.goto(`${base}/app/projects/${labProject}/settings`);await page.getByRole("heading",{name:"Environments",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Create environment",exact:true}).count(),0);assert.equal(await page.getByRole("button",{name:"Request organization deletion",exact:true}).count(),0);
 const forbidden=await page.request.post(`${base}/api/v1/projects/${labProject}/environments`,{headers:{Authorization:`Bearer ${viewerToken}`},data:{name:"Unauthorized environment",type:"STAGING"}});assert.equal(forbidden.status(),403);
 await page.goto(`${base}/app/projects/${labProject}/findings`);await page.getByRole("link",{name:/Members of one organization/}).first().waitFor();
 console.log("UI: viewer can inspect evidence, has no administrative controls, and cannot forge an administrative API command");
 console.log("PASS: full real-API product journey, 28 responsive screenshots, zero budget/credential leakage");
}catch(error){const page=browser?.contexts()[0]?.pages()[0];if(page){console.log("FAILED_URL",page.url());console.log((await page.locator("body").innerText()).slice(0,4000));await page.screenshot({path:join(output,"failure.png"),fullPage:true});}throw error;}finally{
 await browser?.close();if(next?.pid){if(process.platform==="win32")spawnSync("taskkill",["/PID",String(next.pid),"/T","/F"],{windowsHide:true});else{try{process.kill(-next.pid,"SIGTERM");}catch{}}}await new Promise<void>(r=>gateway.close(()=>r()));
 for(const [resource,started] of [[restName,rest],[name,pg]] as const)if(started){assert.equal(docker(["inspect","--format",'{{index .Config.Labels "launchgate.phase"}}',resource]),"11");docker(["rm","--force","--volumes",resource]);}
 if(artifactRoot){const root=resolve(artifactRoot);assert.ok(root.startsWith(resolve(tmpdir())+sep)&&root.split(sep).at(-1)?.startsWith("launchgate-phase11-artifacts-"));await rm(root,{recursive:true,force:true});}
}

}
void main().catch(error=>{console.error(error);process.exitCode=1;});

