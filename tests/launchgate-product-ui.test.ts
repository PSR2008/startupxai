import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { principalFromRequest } from "../src/server/auth/principal";
import { createLaunchGateHandler } from "../src/server/launchgate/api";
import { productReads, safeProductValue } from "../src/server/launchgate/product-reads";
import { productLabCatalog } from "../services/product-lab/catalog";
import { releasePolicySchema } from "../services/releases/contracts";
import { gatePresentation, waiverPresentation } from "../src/components/launchgate/presentation";
import { spawnSync } from "node:child_process";

// The main suite uses react-server conditions; render client components in a
// normal React process, as Next does for their HTML render.
function renderClient(expression:string){
 const result=spawnSync(process.execPath,["--import","tsx","-e",`const React=require('react');global.React=React;const {renderToStaticMarkup}=require('react-dom/server');const {Status,Empty}=require('./src/components/launchgate/ui');process.stdout.write(renderToStaticMarkup(${expression}));`],{encoding:"utf8",windowsHide:true,timeout:30000});
 assert.equal(result.status,0,result.stderr);return result.stdout;
}

test("status badges expose words for approval, failures and incomplete assurance",()=>{
 for(const state of ["SHIP","BLOCK","INCONCLUSIVE","REPRODUCIBLE_FAILURE","STALE","UNVERIFIED","BLOCKED_BY_ENVIRONMENT"]){
  const markup=renderClient(`React.createElement(Status,{value:${JSON.stringify(state)}})`);
  assert.ok(markup.includes(state.replaceAll("_"," ")));
  assert.match(markup,/aria-hidden="true"/);
 }
});
test("empty finding state makes a scoped observation without asserting safety",()=>{
 const markup=renderClient(`React.createElement(Empty,{title:"No reproduced findings for this scope."},"Review release coverage before shipping.")`);
 assert.match(markup,/No reproduced findings for this scope/);assert.match(markup,/Review release coverage/);assert.doesNotMatch(markup,/Everything is secure|100%/);
});
test("LaunchGate owns the homepage while the legacy StartupX homepage remains routed",()=>{const primary=readFileSync("src/app/page.tsx","utf8"),legacy=readFileSync("src/app/startupx/page.tsx","utf8");assert.match(primary,/return <Landing/);assert.match(primary,/LaunchGate/);assert.match(legacy,/return <WaitlistyHomepage/);assert.doesNotMatch(primary,/WaitlistyHomepage|Galaxy|Lightfall/);});
for(const [decision,until,expected] of [["SHIP","2026-10-19T00:00:00Z","SHIP"],["SHIP","2026-10-17T00:00:00Z","STALE"],["SHIP",null,"STALE"],["BLOCK",null,"BLOCK"],["INCONCLUSIVE",null,"INCONCLUSIVE"],[null,null,"INCONCLUSIVE"]] as const){test(`release presentation ${decision}/${until} is ${expected}`,()=>assert.equal(gatePresentation(decision,until,Date.parse("2026-10-18T00:00:00Z")),expected));}
test("waiver labels retain revocation and expiry without claiming PASS",()=>{const now=Date.parse("2026-10-18T00:00:00Z");assert.equal(waiverPresentation(null,"2026-10-19T00:00:00Z",now),"ACTIVE_WAIVER");assert.equal(waiverPresentation(null,"2026-10-17T00:00:00Z",now),"EXPIRED");assert.equal(waiverPresentation("2026-10-17T00:00:00Z","2026-10-19T00:00:00Z",now),"REVOKED");});

test("product evidence projections remove credentials recursively and redact string material",()=>{
 const actual=safeProductValue({title:"Boundary failure",credentialReference:"private-locator",details:[{authorization:"Bearer private",password:"sensitive",expected:"Denied",observed:"Bearer abcdefghijklmnop"}],diff:"const secret = 'sk-abcdefghijklmnopqrst'"});
 const text=JSON.stringify(actual);assert.ok(!text.includes("private-locator"));assert.ok(!text.includes("sensitive"));assert.ok(!text.includes("abcdefghijklmnop"));assert.match(text,/Denied/);assert.match(text,/REDACTED/);
});
test("read projections never include raw context or credential locators",()=>{
 for(const [table,columns] of Object.values(productReads)){assert.ok(table.startsWith("lg_"));assert.ok(!columns.includes("*"));assert.doesNotMatch(columns,/(^|,)(credential[^,]*|secret[^,]*|token[^,]*|lease[^,]*|context|reference_url)(,|$)/);}
});
test("reference catalog preserves exact positive controls, adjacent coverage and non-approval",()=>{
 const catalog=productLabCatalog({invariant_id:randomUUID(),adjacent_id:randomUUID(),policy_id:randomUUID()});const policy=releasePolicySchema.parse(catalog.policy);
 assert.equal(policy.minimumCoverage,1);assert.equal(policy.requiredInconclusive,"NON_APPROVAL");assert.equal(policy.allowExceptions,false);assert.equal(policy.requirements.length,2);assert.deepEqual(catalog.plans.map(x=>x.caseId),["tenant.read","tenant.write"]);assert.ok(catalog.plans.every(x=>x.positiveControl==="AUTHORIZED_EQUIVALENT_OPERATION"));
});
async function handler(member=true,records:Record<string,Record<string,unknown>[]>={}){
 const org=randomUUID(),project=randomUUID(),user=randomUUID(),filters:unknown[][]=[];let selected="";
 const principal=(await principalFromRequest(new Request("http://local",{headers:{authorization:"Bearer controlled"}}),async()=>({userId:user})))!;
 const db={from(table:string){const builder={select(columns:string){selected=columns;return builder;},eq(...args:unknown[]){filters.push([table,...args]);return builder;},order(...args:unknown[]){filters.push(["order",table,...args]);return builder;},async maybeSingle(){return {data:table==="lg_projects"?{id:project,organization_id:org,status:"ACTIVE"}:member?{id:randomUUID(),organization_id:org,user_id:user,role:"VIEWER",status:"ACTIVE"}:null,error:null};},async range(from:number,to:number){filters.push([from,to]);return {data:records[table]??[{id:"safe",password:"never-return"}],error:null};}};return builder;}} as unknown as SupabaseClient;
 return {request:createLaunchGateHandler(async()=>({principal,db})),org,project,filters,getSelected:()=>selected};
}
test("product read authorizes owning tenant, bounds pagination and strips sensitive data",async()=>{
 const h=await handler();const response=await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/findings?offset=50`));assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store");const data=(await response.json()).data;assert.equal(data[0].id,"safe");assert.equal(data[0].password,undefined);assert.equal(data[0].severity,"NOT_RECORDED");assert.ok(h.filters.some(x=>x[1]==="organization_id"&&x[2]===h.org));assert.ok(h.filters.some(x=>x[0]===50&&x[1]===99));
});
test("revoked membership cannot read product records",async()=>{
 const h=await handler(false);const r=await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/findings`));assert.equal(r.status,403);assert.ok(!h.filters.some(x=>x[0]==="lg_findings"));
});
for(const suffix of ["secrets","findings?offset=-1","findings?offset=1.5","findings?offset=100001","findings/unbounded"]){test(`product read rejects unsupported query ${suffix}`,async()=>{const h=await handler();assert.equal((await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/${suffix}`))).status,422);});}
test("read endpoints reject mutation requests",async()=>{const h=await handler();assert.equal((await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/findings`,{method:"POST"}))).status,422);});
test("finding labels use the reproduced invariant version, not a later policy revision",async()=>{
 const invariant=randomUUID();const h=await handler(true,{lg_findings:[{id:randomUUID(),invariant_id:invariant,invariant_version:1}],lg_policy_invariants:[{invariant_id:invariant,invariant_version:2,requirement:{invariant:{statement:"Later requirement",severity:"low"}}},{invariant_id:invariant,invariant_version:1,requirement:{invariant:{statement:"Original boundary",severity:"high",domain:"tenant_isolation"}}}]});
 const r=await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/findings`));assert.equal(r.status,200);const row=(await r.json()).data[0];assert.equal(row.title,"Original boundary");assert.equal(row.severity,"high");
});
test("composite-key pages have a unique ordering tie breaker",async()=>{
 for(const [view,table,key] of [["coverage","lg_gate_evaluation_items","invariant_id"],["occurrences","lg_finding_occurrences","run_id"],["policies","lg_policy_versions","version"]]){const h=await handler();assert.equal((await h.request(new Request(`http://local/api/v1/projects/${h.project}/views/${view}`))).status,200);assert.ok(h.filters.some(x=>x[0]==="order"&&x[1]===table&&x[2]===key));}
});
