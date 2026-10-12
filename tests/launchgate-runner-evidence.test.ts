import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync,randomUUID } from "node:crypto";
import { mkdtemp,readFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signGrant,verifyGrant } from "../services/runner/grant";
import { runnerHandler } from "../services/orchestrator/runner-api";
import { canonical,digest,LocalArtifacts,type ArtifactStore } from "../services/orchestrator/artifacts";
import { admitEvidence } from "../services/orchestrator/evidence";
import { runProbe } from "../services/runner/runner";
import { isolatedRunnerSpec } from "../services/orchestrator/isolation";
import { grantFixture } from "./fixtures/execution";
import type { ExecutionStore } from "../services/orchestrator/store";
const keys=generateKeyPairSync("ed25519");
const noop:ArtifactStore={async put(a,id){return `${a}/${id}`;},async removeAttempt(){}};
function submission(g=grantFixture()) {
 const observations=[{kind:"TRANSPORT_STATUS",status:200}];const bytes=Buffer.from(canonical({observations}));
 return {g,input:{sequence:1,completedAt:new Date().toISOString(),grantId:g.jti,attemptId:g.attemptId,fence:g.fence,authorizationId:g.authorizationId,authorizationVersion:g.authorizationVersion,requestCount:1,spendMicros:0,
  artifacts:[{id:randomUUID(),bytes:bytes.toString("base64"),hash:digest(bytes),type:"PROBE_METADATA",classification:"INTERNAL",redaction:"NO_SENSITIVE_DATA"}],evidence:[],observations}};
}
test("Ed25519 grant verifies only exact signed payload and trusted key",()=>{
 const g=grantFixture(),t=signGrant(g,keys.privateKey);assert.deepEqual(verifyGrant(t,keys.publicKey),g);
 assert.throws(()=>verifyGrant(t,generateKeyPairSync("ed25519").publicKey));assert.throws(()=>verifyGrant(t.replace(/^./,t[0]==="A"?"B":"A"),keys.publicKey));
});
test("expired grant, wrong audience, excessive authority and sensitive extra fields denied",()=>{
 const g=grantFixture(),t=signGrant(g,keys.privateKey);assert.throws(()=>verifyGrant(t,keys.publicKey,g.exp*1000));
 for(const value of [{aud:"browser"},{supabaseServiceRoleKey:"forbidden"},{githubPrivateKey:"forbidden"},{vercelToken:"forbidden"},{paymentMode:"LIVE"}])assert.throws(()=>signGrant(Object.assign({},g,value),keys.privateKey));
});
test("runner signed capability exposes only scoped authority, no provider secrets",()=>{
 const payload=JSON.stringify(grantFixture());for(const name of ["SUPABASE_SERVICE_ROLE_KEY","GITHUB_PRIVATE_KEY","VERCEL_TOKEN","DATABASE_URL","token","password"])assert.ok(!payload.includes(name));
});
test("browser bearer, unsigned token, GET and wrong internal route cannot submit",async()=>{
 let calls=0;const handler=runnerHandler(keys.publicKey,{async command(){calls++;}},noop);
 for(const token of ["browser-supabase-session","unsigned",""]){const r=await handler(new Request("https://internal/internal/runner/start",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:"{}"}));assert.equal(r.status,403);}
 assert.equal((await handler(new Request("https://internal/internal/runner/start"))).status,403);assert.equal(calls,0);
});
test("authenticated runner evidence binds complete immutable provenance",async()=>{
 const {g,input}=submission();let command:Record<string,unknown>|undefined;
 const store:ExecutionStore={async command(action,data){if(action==="COMPLETE")command=data;}};
 const result=await admitEvidence(g,input,store,noop);assert.match(result.manifestDigest,/^sha256:/);assert.ok(command);
 const manifest=command.manifest as Record<string,unknown>;assert.equal(manifest.commitSha,g.commitSha);assert.equal(manifest.authorizationVersion,1);assert.equal(manifest.kind,"INFRASTRUCTURE_OBSERVATION");
});
for(const field of ["attemptId","grantId","authorizationId","authorizationVersion","fence"])
 test(`evidence rejects mismatched ${field}`,async()=>{const {g,input}=submission();await assert.rejects(()=>admitEvidence(g,{...input,[field]:typeof input[field as keyof typeof input]==="number"?999:randomUUID()},{async command(){throw new Error("must not reach DB");}},noop));});
test("evidence rejects stale timestamps, unknown fields, model/fixture evidence and sensitive artifacts",async()=>{
 const {g,input}=submission();const store:ExecutionStore={async command(){}};
 await assert.rejects(()=>admitEvidence(g,{...input,completedAt:"2000-01-01T00:00:00.000Z"},store,noop));
 await assert.rejects(()=>admitEvidence(g,{...input,verdict:"VERIFIED"},store,noop));
 await assert.rejects(()=>admitEvidence(g,{...input,evidence:[{source:"MODEL_OUTPUT"}]},store,noop));
 const bytes=Buffer.from("secret=sk_live_sensitive");await assert.rejects(()=>admitEvidence(g,{...input,artifacts:[{...input.artifacts[0],bytes:bytes.toString("base64"),hash:digest(bytes)}]},store,noop),/REDACTION/);
});
test("artifact hashes, duplicates, and byte ceilings validated before persistence",async()=>{
 const {g,input}=submission();let calls=0;const store:ExecutionStore={async command(){calls++;}};
 await assert.rejects(()=>admitEvidence(g,{...input,artifacts:[{...input.artifacts[0],hash:`sha256:${"0".repeat(64)}`}]},store,noop));
 await assert.rejects(()=>admitEvidence(g,{...input,artifacts:[input.artifacts[0],input.artifacts[0]]},store,noop));
 g.limits.artifactBytes=1;await assert.rejects(()=>admitEvidence(g,input,store,noop));assert.equal(calls,0);
});
test("cancellation/fencing loss at publication blocks trusted manifest",async()=>{
 const {g,input}=submission();let saved=false;
 await assert.rejects(()=>admitEvidence(g,input,{async command(action){if(action==="COMPLETE")throw new Error("FENCE_LOST");}},{async put(a,id){saved=true;return `${a}/${id}`;},async removeAttempt(){}}),/FENCE_LOST/);assert.equal(saved,true);
});
test("private local artifacts are immutable, hash checked and removable by attempt",async()=>{
 const root=await mkdtemp(join(tmpdir(),"launchgate-artifacts-"));const store=new LocalArtifacts(root);const attempt=randomUUID(),id=randomUUID();const bytes=Buffer.from("metadata");
 try{const ref=await store.put(attempt,id,bytes,digest(bytes));assert.equal(await readFile(join(root,ref),"utf8"),"metadata");await store.put(attempt,id,bytes,digest(bytes));await assert.rejects(()=>store.put(attempt,id,Buffer.from("changed"),digest("changed")));await assert.rejects(()=>store.put("../escape",id,bytes,digest(bytes)));await store.removeAttempt(attempt);await assert.rejects(()=>readFile(join(root,ref)));}finally{await rm(root,{recursive:true,force:true});}
});
test("controlled runner recognizes revocation in under ten seconds",async(t)=>{
 const g=grantFixture();let checks=0,abortedAt=0;const start=Date.now();
 await runProbe(signGrant(g,keys.privateKey),keys.publicKey,{async call(action){if(action==="check"){checks++;throw new Error("REVOKED");}}},new AbortController().signal,
 {resolve:async()=>[{address:"93.184.216.34",family:4}],transport:async(_u,_a,_h,signal)=>new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>{abortedAt=Date.now();reject(new Error("ABORTED"));},{once:true});})});
 assert.ok(checks>0);const elapsed=abortedAt-start;assert.ok(elapsed>0&&elapsed<=10000,`recognition ${elapsed}ms`);t.diagnostic(`Controlled revocation recognition: ${elapsed}ms from probe start to transport abort`);
});
test("isolated launch specification never inherits control-plane environment",()=>{
 process.env.LAUNCHGATE_TEST_SECRET="sentinel-do-not-copy";
 try{const spec=isolatedRunnerSpec({attemptId:randomUUID(),grant:"signed-grant",deadline:new Date().toISOString()},{imageDigest:`sha256:${"a".repeat(64)}`,controlOrigin:"https://control.example.com/",publicKey:"public-key"});
 assert.deepEqual(Object.keys(spec.environment).sort(),["LAUNCHGATE_CONTROL_ORIGIN","LAUNCHGATE_RUNNER_PUBLIC_KEY"]);assert.ok(!JSON.stringify(spec).includes("sentinel-do-not-copy"));assert.equal(spec.customerCode,false);assert.equal(spec.stdin,"signed-grant");}finally{delete process.env.LAUNCHGATE_TEST_SECRET;}
});
test("runner root probe produces no invariant assertions or raw response artifact",async()=>{
 const g=grantFixture();const actions:string[]=[];let payload:unknown;
 await runProbe(signGrant(g,keys.privateKey),keys.publicKey,{async call(action,_token,input){actions.push(action);if(action==="evidence")payload=input;}},new AbortController().signal,{resolve:async()=>[{address:"93.184.216.34",family:4}],transport:async()=>({status:200,bytes:12})});
 assert.deepEqual(actions,["start","request","evidence"]);assert.deepEqual((payload as {evidence:unknown[]}).evidence,[]);
});
