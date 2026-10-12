import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { type SupabaseClient } from "@supabase/supabase-js";
import { principalFromRequest, isVerifiedPrincipal, type VerifiedPrincipal } from "../src/server/auth/principal";
import { requireOrganizationMembership, requireOrganizationRole, requireProjectAccess, requireMembershipManagement, type AuthorizationReader } from "../src/server/launchgate/authorization";
import { createLaunchGateHandler, handleLaunchGateRequest } from "../src/server/launchgate/api";
import { databaseError } from "../src/server/launchgate/database";
import { type OrganizationRole, type Membership, retentionSchema, secretPublicColumns } from "../src/server/launchgate/domain";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const org = uid(1), user = uid(2), project = uid(3), membershipId = uid(4);
async function principal() { return (await principalFromRequest(new Request("https://local", { headers: { authorization: "Bearer test-only" } }), async () => ({ userId: user })))!; }
const membership = (role: OrganizationRole = "OWNER"): Membership => ({ id: membershipId, organization_id: org, user_id: user, role, status: "ACTIVE" });
const reader = (member: Membership | null = membership()): AuthorizationReader => ({ membership: async () => member, project: async () => ({ id: project, organization_id: org, status: "ACTIVE" }) });
const denied = (error: unknown) => (error as { code: string }).code === "ACCESS_DENIED";

test("a serialized principal cannot acquire runtime verification provenance", async () => {
  const valid = await principal();
  assert.ok(isVerifiedPrincipal(valid)); assert.ok(!isVerifiedPrincipal(JSON.parse(JSON.stringify(valid))));
  await assert.rejects(requireOrganizationMembership(reader(), { userId: user, origin: "supabase_verified_bearer" }, org), { code: "AUTHENTICATION_REQUIRED" });
});
for (const state of [null, { ...membership(), status: "DISABLED" }, { ...membership(), status: "REMOVED" }, { ...membership(), user_id: uid(9) }, { ...membership(), organization_id: uid(9) }, { ...membership(), role: "internal" }]) {
  test(`membership lookup fails closed: ${JSON.stringify(state)}`, async () => {
    await assert.rejects(requireOrganizationMembership(reader(state as Membership | null), await principal(), org), denied);
  });
}
test("role hierarchy applies consistently", async () => {
  const verified = await principal(); const roles: OrganizationRole[] = ["VIEWER", "DEVELOPER", "ADMIN", "OWNER"];
  for (let i=0;i<roles.length;i++) for (let j=0;j<roles.length;j++) {
    const operation = requireOrganizationRole(reader(membership(roles[i])), verified, org, roles[j]);
    if (i>=j) assert.equal((await operation).membership.role, roles[i]); else await assert.rejects(operation, denied);
  }
});
test("project access requires its owning organization membership", async () => {
  const verified = await principal();
  assert.equal((await requireProjectAccess(reader(), verified, project)).organizationId, org);
  await assert.rejects(requireProjectAccess(reader({ ...membership(), organization_id: uid(9) }), verified, project), denied);
  await assert.rejects(requireProjectAccess({ ...reader(), project: async () => null }, verified, project), denied);
});
test("membership management restricts ADMIN to developer/viewer", async () => {
  const context = await requireOrganizationMembership(reader(membership("ADMIN")), await principal(), org);
  requireMembershipManagement(context, "DEVELOPER", "VIEWER");
  for (const [target, next] of [["OWNER","VIEWER"],["VIEWER","OWNER"],["ADMIN","DEVELOPER"]] as const) assert.throws(() => requireMembershipManagement(context, target, next), denied);
});
test("retention input enforces finite whole sane durations and strict fields", () => {
  for (const days of [0,-1,1.5,3651,Infinity,NaN]) assert.equal(retentionSchema.safeParse({ category: "ARTIFACTS", durationDays: days }).success,false);
  assert.equal(retentionSchema.parse({ category: "ARTIFACTS", durationDays: 1 }).durationDays,1);
  assert.equal(retentionSchema.safeParse({ category: "ARTIFACTS", durationDays: 1, legalHoldOverride: true }).success,false);
});
test("database errors map to safe existing error contract", () => {
  for (const [code,expected] of [["42501","ACCESS_DENIED"],["23514","INVALID_REQUEST"],["23503","INVALID_REQUEST"],["23505","INVALID_REQUEST"],["XX000","INTERNAL_ERROR"]]) assert.throws(() => databaseError({code}), {code:expected});
});

// These tests cover HTTP parsing/authorization/wiring only. RLS proof lives in the
// independent real PostgreSQL suite, never in this fake query adapter.
async function api(role: OrganizationRole = "OWNER", dbError: { code: string; message?: string } | null = null) {
  const calls: { name: string; args: Record<string,unknown> }[] = [];
  const reads: { table: string; columns: string }[] = [];
  const db = {
    from(table: string) {
      const builder = {
        select(columns: string) { reads.push({table,columns}); return builder; },
        eq() { return builder; }, order() { return builder; }, limit() { return builder; },
        async maybeSingle() { return { data: table === "lg_projects" ? {id: project, organization_id: org,status:"ACTIVE"} : membership(role), error: null }; },
        async single() { return { data: {id:org}, error: null }; },
        then(resolve: (value: unknown) => void) { resolve({ data: [], error: null }); },
      };
      return builder;
    },
    rpc(name: string, args: Record<string,unknown>) {
      calls.push({name,args});
      const response = { data: name === "lg_read_security_membership" ? membership(role) : {id:org}, error: dbError };
      return { ...response, single: async () => response, maybeSingle: async () => response };
    },
  } as unknown as SupabaseClient;
  const verified = await principal();
  return { handler: createLaunchGateHandler(async () => ({ principal: verified, db })), calls, reads };
}
function request(path: string, method = "GET", input?: unknown) {
  return new Request(`https://local/api/v1/${path}`, { method, ...(input !== undefined ? { headers:{"Content-Type":"application/json"}, body:JSON.stringify(input) } : {}) });
}
test("LaunchGate HTTP requires authentication before database access", async () => {
  const response = await handleLaunchGateRequest(request("organizations")); assert.equal(response.status,401);
  assert.equal((await response.json()).error.code,"AUTHENTICATION_REQUIRED");
});
test("organization creation uses narrow RPC and server correlation", async () => {
  const {handler,calls} = await api(); const response = await handler(request("organizations","POST",{name:"Acme"}));
  assert.equal(response.status,201); assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal(calls[0].name,"lg_create_organization"); assert.equal(calls[0].args.p_name,"Acme");
  assert.equal(calls[0].args.p_correlation,response.headers.get("X-Correlation-ID"));
});
test("organization creation rejects forged ownership and arbitrary fields", async () => {
  const {handler,calls} = await api(); assert.equal((await handler(request("organizations","POST",{name:"Acme",created_by:uid(9)}))).status,422); assert.equal(calls.length,0);
});
test("HTTP bodies enforce content type, valid JSON and size", async () => {
  const {handler} = await api();
  for (const req of [new Request("https://local/api/v1/organizations",{method:"POST",body:"{}"}),new Request("https://local/api/v1/organizations",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"}),request("organizations","POST",{name:"a".repeat(17000)})]) assert.equal((await handler(req)).status,422);
});
test("invalid resource UUID is rejected without command", async () => {
  const {handler,calls}=await api(); assert.equal((await handler(request("organizations/not-an-id"))).status,422); assert.equal(calls.length,0);
});
test("HTTP viewer cannot create project or add members", async () => {
  const {handler,calls}=await api("VIEWER");
  assert.equal((await handler(request("projects","POST",{organizationId:org,name:"No"}))).status,403);
  assert.equal((await handler(request(`organizations/${org}/members`,"POST",{userId:uid(9),role:"VIEWER"}))).status,403); assert.equal(calls.length,0);
});
test("HTTP admin cannot grant OWNER or modify owner membership", async () => {
  const {handler,calls}=await api("ADMIN");
  assert.equal((await handler(request(`organizations/${org}/members`,"POST",{userId:uid(9),role:"OWNER"}))).status,403);
  assert.equal((await handler(request(`organizations/${org}/members/${membershipId}`,"PATCH",{role:"OWNER",status:"ACTIVE"}))).status,403); assert.equal(calls.length,0);
});
test("HTTP developer can create project via authorized RPC", async () => {
  const {handler,calls}=await api("DEVELOPER"); assert.equal((await handler(request("projects","POST",{organizationId:org,name:"App"}))).status,201); assert.equal(calls[0].name,"lg_create_project");
});
test("HTTP membership removal invokes soft-removal RPC", async () => {
  const {handler,calls}=await api(); assert.equal((await handler(request(`organizations/${org}/members/${membershipId}`,"DELETE"))).status,200); assert.equal(calls[0].args.p_action,"REMOVE");
});
test("HTTP owner transfer uses explicit atomic transfer command", async () => {
  const {handler,calls}=await api(); assert.equal((await handler(request(`organizations/${org}/ownership-transfer`,"POST",{membershipId}))).status,200); assert.equal(calls[0].args.p_action,"TRANSFER");
});
test("HTTP deletion does not accept forged state or tasks", async () => {
  const {handler,calls}=await api(); assert.equal((await handler(request(`organizations/${org}/deletion-requests`,"POST",{state:"COMPLETED"}))).status,422); assert.equal(calls.length,0);
  assert.equal((await handler(request(`organizations/${org}/deletion-requests`,"POST",{}))).status,202); assert.equal(calls[0].name,"lg_request_deletion");
});
test("HTTP developer cannot request deletion or inspect security audit", async () => {
  const {handler}=await api("DEVELOPER"); assert.equal((await handler(request(`organizations/${org}/deletion-requests`,"POST",{}))).status,403);
  assert.equal((await handler(request(`organizations/${org}/audit`))).status,403);
});
test("secret metadata API selects only public metadata columns", async () => {
  const {handler,reads}=await api(); assert.equal((await handler(request(`organizations/${org}/secret-references`))).status,200);
  assert.equal(reads.at(-1)?.columns,secretPublicColumns); assert.ok(!secretPublicColumns.includes("backend_reference"));
});
test("provider diagnostics never appear in API error response", async () => {
  const {handler}=await api("OWNER",{code:"XX000",message:"secret-provider-token"}); const response=await handler(request("organizations","POST",{name:"Fail"}));
  assert.equal(response.status,500); assert.ok(!(await response.text()).includes("secret-provider-token"));
});
test("new LaunchGate implementation cannot import legacy roles or service admin clients", () => {
  const source=readdirSync("src/server/launchgate").filter(f=>f.endsWith(".ts")).map(f=>readFileSync(`src/server/launchgate/${f}`,"utf8")).join("\n");
  assert.doesNotMatch(source,/getSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|\.from\(["']user_roles["']\)|\.from\(["']user_plans["']\)/);
});
test("type-only structural principal cannot bypass authorization service", async () => {
  const forged = {userId:user,origin:"supabase_verified_bearer"} as VerifiedPrincipal;
  await assert.rejects(requireProjectAccess(reader(),forged,project),{code:"AUTHENTICATION_REQUIRED"});
});
test("Phase 3 viewer cannot connect GitHub or request source snapshots",async()=>{
  const {handler,calls}=await api("VIEWER");
  assert.equal((await handler(request(`projects/${project}/github/setup`,"POST",{installationId:1,repositoryId:2}))).status,403);
  assert.equal((await handler(request(`projects/${project}/repositories/${membershipId}/snapshots`,"POST",{commitSha:"a".repeat(40)}))).status,403);
  assert.equal(calls.length,0);
});
test("Phase 3 source snapshot route only accepts immutable commit SHA",async()=>{
  const {handler,calls}=await api("DEVELOPER");
  assert.equal((await handler(request(`projects/${project}/repositories/${membershipId}/snapshots`,"POST",{commitSha:"main"}))).status,422);
  assert.equal(calls.length,0);
  assert.equal((await handler(request(`projects/${project}/repositories/${membershipId}/snapshots`,"POST",{commitSha:"a".repeat(40)}))).status,202);
  assert.equal(calls[0].name,"lg_request_snapshot");
});
test("Phase 3 developer cannot confirm policy or submit fabricated provenance",async()=>{
  const developer=await api("DEVELOPER");assert.equal((await developer.handler(request(`projects/${project}/invariant-proposals/${membershipId}/confirm`,"POST",{action:"CONFIRM",statement:"Policy",requestKey:org}))).status,403);
  const owner=await api();assert.equal((await owner.handler(request(`projects/${project}/invariant-proposals/${membershipId}/confirm`,"POST",{action:"CONFIRM",statement:"Policy",requestKey:org,evidence:"forged"}))).status,422);
});
test("Phase 3 confirmation accepts explicit version action and rejects likely secret text",async()=>{
 const {handler,calls}=await api();assert.equal((await handler(request(`projects/${project}/invariant-proposals/${membershipId}/confirm`,"POST",{action:"REFINE",statement:"Only owners may change membership.",requestKey:org}))).status,201);assert.equal(calls[0].name,"lg_review_invariant");
 assert.equal((await handler(request(`projects/${project}/invariant-proposals/${membershipId}/confirm`,"POST",{action:"REFINE",statement:"sk-ant-syntheticsecret123456789",requestKey:org}))).status,422);
});

test("Phase 4 viewer cannot create runs and developer cannot authorize targets",async()=>{
 const viewer=await api("VIEWER");assert.equal((await viewer.handler(request(`projects/${project}/runs`,"POST",{}))).status,403);
 const developer=await api("DEVELOPER");assert.equal((await developer.handler(request(`projects/${project}/targets/authorize`,"POST",{}))).status,403);assert.equal(developer.calls.length,0);
});
test("Phase 4 run API only invokes user command with bounded accepted fields",async()=>{
 const {handler,calls}=await api("DEVELOPER");const body={snapshotId:membershipId,authorizationId:org,requestKey:user,invariants:[]};
 assert.equal((await handler(request(`projects/${project}/runs`,"POST",{...body,fence:999}))).status,422);assert.equal(calls.length,0);
 assert.equal((await handler(request(`projects/${project}/runs`,"POST",body))).status,202);assert.equal(calls[0].name,"lg_execution_command");assert.equal(calls[0].args.p_action,"RUN");
});
test("Phase 4 cancellation records intent and cannot accept forged completion",async()=>{
 const {handler,calls}=await api("DEVELOPER");assert.equal((await handler(request(`projects/${project}/runs/${membershipId}/cancel`,"POST",{state:"COMPLETED"}))).status,422);
 assert.equal((await handler(request(`projects/${project}/runs/${membershipId}/cancel`,"POST",{}))).status,202);assert.equal(calls[0].args.p_action,"CANCEL");
});
test("Phase 4 target authorization cannot widen payment or operation scope",async()=>{
 const {handler,calls}=await api();const input={deploymentId:membershipId,requestKey:user,expiresAt:new Date(Date.now()+60000).toISOString()};
 assert.equal((await handler(request(`projects/${project}/targets/authorize`,"POST",{...input,paymentMode:"LIVE"}))).status,422);assert.equal(calls.length,0);
 assert.equal((await handler(request(`projects/${project}/targets/authorize`,"POST",input))).status,201);assert.equal(calls[0].args.p_action,"AUTHORIZE");
});
