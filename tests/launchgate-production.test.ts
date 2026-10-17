import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { grantFixture } from "./fixtures/execution";
import { scopeKey, capabilityNames, type Scope, type SandboxProvider, type EgressPolicy, type SandboxSpec } from "../services/production/contracts";
import { egressPolicy, authorizeDestination, confinedScratch, policyDigest } from "../services/production/policy";
import { LocalTestSecretStore, CredentialBroker } from "../services/production/secrets";
import { RunnerKeyRing } from "../services/production/rotation";
import { ProductionArtifacts, type PrivateObjectBackend } from "../services/production/artifacts";
import { capabilityRegistry, readiness, publicReadiness, productionConfigSchema, type Qualification } from "../services/production/readiness";
import { Observer, ProviderCircuit, ProviderFailure } from "../services/production/operations";
import { ProductionSandboxRunner, productionRunner } from "../services/production/runner";
import { CleanupReaper } from "../services/production/reaper";
import { SandboxSupervisor } from "../services/production/supervisor";
import { requireLocalEnvironment, executionEnvironment, localQualificationReport } from "../src/server/production/configuration";
import { resourceCleaner } from "../services/production/cleanup";
import { scopedCredentialDelivery } from "../services/production/delivery";
import { qualificationReader } from "../src/server/production/store";
const scope = (): Scope => ({ environment: "test", organizationId: randomUUID(), runId: randomUUID(), attemptId: randomUUID() });
const config = () => ({ environment: "production", resourceEnvironment: "production", sandbox: "production", secrets: "managed", artifacts: "managed", privateArtifacts: true, encryption: true, signingKeyConfigured: true, githubSecret: "not-a-real-credential-0123456789", unrestrictedEgress: false, paymentMode: "TEST_ONLY" });
test("Phase 10 scope refuses traversal and unrelated tenant identity", () => { assert.throws(() => scopeKey({ ...scope(), attemptId: "../secret" })); assert.notEqual(scopeKey(scope()), scopeKey(scope())); });
for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "100.100.100.200", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"]) test(`Phase 10 gateway denies ${ip}`, () => {
  const p = egressPolicy(grantFixture()); assert.throws(() => authorizeDestination(p, `https://${p.host}/`, [{ address: ip, family: ip.includes(":") ? 6 : 4 }]));
});
test("Phase 10 gateway exact host/port, subresources, DNS mixed answers and rebinding", () => {
  const p = egressPolicy(grantFixture()), publicDns = [{ address: "8.8.8.8", family: 4 }];
  assert.equal(authorizeDestination(p, `https://${p.host}/asset.js`, publicDns).address, "8.8.8.8");
  for (const url of ["https://other.example/", `https://${p.host}:444/`, `http://${p.host}/`, `https://token@${p.host}/`]) assert.throws(() => authorizeDestination(p, url, publicDns));
  assert.throws(() => authorizeDestination(p, `https://${p.host}`, [...publicDns, { address: "127.0.0.1", family: 4 }]));
  assert.equal(p.redirects, "DENY"); assert.equal(p.providerEndpoints.length, 0);
});
for (const path of ["/etc/passwd", "/scratch/../secret", "/scratch/a/../../secret", "C:\\secret", "/scratch/a\\secret", "/scratch/a/%2e%2e"]) test(`Phase 10 filesystem policy rejects ${path}`, () => assert.throws(() => confinedScratch(path)));
test("Phase 10 scoped broker zeroizes bytes and revokes lease, including failed injection", async () => {
  const s = scope(), secrets = new LocalTestSecretStore(), ref = await secrets.put(s, "TARGET_SESSION", Buffer.from("synthetic-session")); let bytes: Uint8Array | undefined;
  const broker = new CredentialBroker(secrets, async () => {});
  await broker.deliver({ scope: s, reference: ref, expiresAt: Date.now() + 60000 }, async b => { bytes = b; assert.equal(Buffer.from(b).toString(), "synthetic-session"); });
  assert.ok(bytes!.every(b => b === 0)); assert.equal(secrets.activeLeases, 0);
  await assert.rejects(() => broker.deliver({ scope: s, reference: ref, expiresAt: Date.now() + 60000 }, async () => { throw new Error("injection unavailable"); }));
  assert.equal(secrets.activeLeases, 0); secrets.dispose();
});
for (const purpose of ["RUNNER_SIGNING", "GITHUB_APP", "WEBHOOK", "ARTIFACT_SIGNING", "PROVIDER"] as const) test(`Phase 10 broker refuses ${purpose}`, async () => {
  const s=scope(), secrets=new LocalTestSecretStore(), reference=await secrets.put(s,purpose,Buffer.from("synthetic"));
  await assert.rejects(()=>new CredentialBroker(secrets,async()=>{}).deliver({scope:s,reference,expiresAt:Date.now()+10000},async()=>assert.fail()));secrets.dispose();
});
test("Phase 10 secret scope, audience, expiry, rotation and revocation", async () => {
  let now=1000;const secrets=new LocalTestSecretStore(()=>now),s=scope(),ref=await secrets.put(s,"PREVIEW_BYPASS",Buffer.from("old"));
  const lease=await secrets.lease(ref,`runner:${s.attemptId}`,2000);
  await assert.rejects(()=>secrets.withLease(lease,{...s,environment:"production"},lease.audience,async()=>{}));
  await assert.rejects(()=>secrets.withLease(lease,s,"wrong-audience",async()=>{}));
  const next=await secrets.rotate(ref,Buffer.from("new"),100); await secrets.withLease(lease,s,lease.audience,async b=>assert.equal(Buffer.from(b).toString(),"old"));
  now=1101;await assert.rejects(()=>secrets.withLease(lease,s,lease.audience,async()=>{}));
  await secrets.revoke(next.id);assert.equal(secrets.activeLeases,0);await assert.rejects(()=>secrets.lease(next,lease.audience,2000));now=2001;await secrets.expire();assert.equal(secrets.activeLeases,0);secrets.dispose();
});
test("Phase 10 signing rotation permits bounded overlap then revokes old signatures",()=>{
  let now=Date.now();const ring=new RunnerKeyRing(()=>now),g=grantFixture();assert.throws(()=>ring.rotate("invalid",generateKeyPairSync("ed25519"),NaN));ring.rotate("first",generateKeyPairSync("ed25519"),0);const first=ring.sign(g);
  ring.rotate("second",generateKeyPairSync("ed25519"),1000);const second=ring.sign(g);assert.equal(ring.verify(first).attemptId,g.attemptId);now+=1001;assert.throws(()=>ring.verify(first));assert.equal(ring.verify(second).attemptId,g.attemptId);ring.revoke("second");assert.throws(()=>ring.verify(second));
});
test("Phase 10 object storage refuses hash conflicts, cross-attempt access, public backend and upload failure",async()=>{
  const s=scope(),objects=new Map<string,string>();const backend:PrivateObjectBackend={kind:"local-test",private:true,encryption:"PROVIDER_KMS",async putIfAbsent(k,_b,m){const hash=objects.get(k)??m.hash;objects.set(k,hash);return{hash};},async deletePrefix(p){for(const k of objects.keys())if(k.startsWith(p))objects.delete(k);},async signedDownload(){return"https://objects.example/signed";}};
  const actions:string[]=[];const {digest}=await import("../services/runner/metadata");const store=new ProductionArtifacts(backend,s,async()=>{},Date.now,{async command(action){actions.push(action);}}),id=randomUUID(),bytes=Buffer.from("redacted evidence");
  const key=await store.put(s.attemptId,id,bytes,digest(bytes));assert.ok(key.startsWith(scopeKey(s)));await store.put(s.attemptId,id,bytes,digest(bytes));
  await assert.rejects(()=>store.put(s.attemptId,id,Buffer.from("changed"),digest("changed")));await assert.rejects(()=>store.removeAttempt(randomUUID()));
  assert.throws(()=>new ProductionArtifacts({...backend,private:false} as unknown as PrivateObjectBackend,s,async()=>{}));
  await assert.rejects(()=>new ProductionArtifacts({...backend,async putIfAbsent(){throw new Error("unavailable");}},s,async()=>{},Date.now,{async command(a,d){actions.push(a);if(a==="QUALIFY")assert.equal(d.status,"DEGRADED");}}).put(s.attemptId,randomUUID(),bytes,digest(bytes)));assert.ok(actions.includes("QUALIFY"));
  await store.removeAttempt(s.attemptId);assert.equal(objects.size,0);assert.ok(actions.includes("REGISTER"));assert.equal(actions.at(-1),"DESTROYED");
});
for(const [key,value] of Object.entries({sandbox:"local-test",secrets:"local-test",artifacts:"local-test",privateArtifacts:false,encryption:false,signingKeyConfigured:false,unrestrictedEgress:true,paymentMode:"LIVE",resourceEnvironment:"staging",githubSecret:"placeholder-secret"})) test(`Phase 10 production configuration rejects ${key}`,()=>assert.equal(productionConfigSchema.safeParse({...config(),[key]:value}).success,false));
test("Phase 10 missing, synthetic, stale and degraded capability cannot become production ready",()=>{
  const now=Date.now(),records:Qualification[]=capabilityNames.map(capability=>({capability,environment:"production",status:"VERIFIED",live:true,evidenceDigest:`sha256:${"a".repeat(64)}`,observedAt:now-100,expiresAt:now+1000}));
  assert.equal(readiness(config(),[],now).productionReady,false);assert.equal(readiness(config(),records,now).productionReady,true);
  for(const changes of [{live:false},{expiresAt:now-1},{environment:"staging"},{status:"DEGRADED"}]) { const altered=records.map(r=>r.capability==="sandbox.production"?{...r,...changes}:r) as Qualification[];assert.equal(readiness(config(),altered,now).productionReady,false); }
  assert.equal(capabilityRegistry("production",[],now)["sandbox.production"],"BLOCKED_BY_ENVIRONMENT");assert.equal(JSON.stringify(publicReadiness(readiness(config(),[],now))).includes("github"),false);
});
test("Phase 10 observer rejects arbitrary payloads and credentials",async()=>{
  const events:unknown[]=[];const observer=new Observer(async e=>{events.push(e);});await observer.emit({event:"CREDENTIAL_LEASED",correlationId:randomUUID(),outcome:"OK"});
  assert.throws(()=>observer.emit({event:"CREDENTIAL_LEASED",correlationId:randomUUID(),secret:"should-not-log"} as never));assert.equal(events.length,1);
});
test("Phase 10 retry classification, bounded backoff and circuit recovery",async()=>{
  let now=0,calls=0;const delays:number[]=[],c=new ProviderCircuit(()=>now,async ms=>{delays.push(ms);});
  await assert.rejects(()=>c.execute(async()=>{calls++;throw new ProviderFailure("RATE_LIMIT",999999);},{idempotent:true}));assert.equal(calls,3);assert.deepEqual(delays,[5000,5000]);assert.equal(c.degraded,true);
  await assert.rejects(()=>c.execute(async()=>{calls++;return true;},{idempotent:true}));assert.equal(calls,3);now=30001;assert.equal(await c.execute(async()=>true,{idempotent:true}),true);
  for(const code of ["CREDENTIAL","REVOKED","TARGET","POLICY","MALFORMED"] as const){let n=0;await assert.rejects(()=>new ProviderCircuit().execute(async()=>{n++;throw new ProviderFailure(code);},{idempotent:true}));assert.equal(n,1);}
  let n=0;await assert.rejects(()=>new ProviderCircuit().execute(async()=>{n++;throw new ProviderFailure("TIMEOUT");},{idempotent:false}));assert.equal(n,1);
});
function sandboxFixture(){let spec:SandboxSpec,egress:EgressPolicy;const calls:string[]=[];const p:SandboxProvider={kind:"production",name:"contract-only",async createSandbox(s){spec=s;calls.push("create");return{id:s.idempotencyKey};},async configureEgressPolicy(_id,e){egress=e;calls.push("egress");},async injectScopedCredential(_id,name){assert.equal(name,"execution-grant");calls.push("inject");},async startExecution(_id,op){assert.equal(op,"launchgate-controlled-verification");calls.push("start");},async heartbeat(){return{alive:true};},async *streamEvents(){yield{sequence:1,type:"STARTED",code:"OK"};},async terminate(){calls.push("terminate");},async destroy(){calls.push("destroy");},async getUsage(){return{cpuMillis:1,memoryBytes:1,diskBytes:1};},async getAttestationMetadata(id){return{provider:"contract-only",sandboxId:id,scope:spec.scope,imageDigest:spec.imageDigest,policyDigest:policyDigest(egress),isolation:"HARDWARE",issuedAt:new Date(Date.now()-1).toISOString(),expiresAt:spec.deadline,proofReference:"attestation:contract-only"};}};return{p,calls};}
test("Phase 10 sandbox creates durable intent before scoped injection; cleanup is idempotent",async()=>{
  const {p,calls}=sandboxFixture(),g=grantFixture();g.runner.imageDigest=`sha256:${"a".repeat(64)}`;const records:Record<string,unknown>[]=[];
  const store={async command(a:string,d:Record<string,unknown>){calls.push(a);if(a==="REGISTER")records.push(d);if(a==="ATTEMPT")return records;}};
  const runner=new ProductionSandboxRunner(p,store,{verify:()=>g},"staging",async()=>{},new Observer(async()=>{}));
  await runner.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:"synthetic-token",deadline:new Date(g.exp*1000).toISOString()});
  assert.deepEqual(calls.slice(0,5),["REGISTER","create","egress","inject","start"]);await runner.terminate(g.attemptId);await runner.cleanup(g.attemptId);assert.ok(calls.includes("destroy"));
});
for(const stage of ["createSandbox","configureEgressPolicy","getAttestationMetadata","injectScopedCredential","startExecution"] as const) test(`Phase 10 sandbox ${stage} failure cannot approve and schedules recovery`,async()=>{
  const {p}=sandboxFixture(),g=grantFixture();g.runner.imageDigest=`sha256:${"b".repeat(64)}`;const actions:string[]=[];const failing={...p,[stage]:async()=>{throw new Error("secret provider response");}};
  const runner=new ProductionSandboxRunner(failing,{async command(a,d){actions.push(a);if(a==="QUALIFY"){assert.equal(d.status,"DEGRADED");assert.equal(d.live,false);assert.equal(d.capability,"sandbox.production");}}}, {verify:()=>g},"staging",async()=>{},new Observer(async()=>{}));
  await assert.rejects(()=>runner.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:"test",deadline:new Date(g.exp*1000).toISOString()}),/SANDBOX_INCONCLUSIVE/);assert.deepEqual(actions,["REGISTER","EXPIRE","QUALIFY"]);
});
test("Phase 10 startup refuses local provider and unqualified production provider",()=>{
  const {p}=sandboxFixture(),args={config:config(),qualifications:[],provider:p,store:{async command(){}},grants:{verify:()=>grantFixture()},authorize:async()=>{},observer:new Observer(async()=>{})};
  assert.throws(()=>productionRunner(args),/NOT_QUALIFIED/);assert.throws(()=>new ProductionSandboxRunner({...p,kind:"local-test"},args.store,args.grants,"production",args.authorize,args.observer),/LOCAL_PROVIDER/);
});
test("Phase 10 reaper restarts from durable claim and never acknowledges failed destruction",async()=>{
  const record={id:randomUUID(),scope:scope(),kind:"SANDBOX",provider:"contract-only",externalId:"owned",expiresAt:new Date().toISOString(),fence:1};let done=false;const actions:string[]=[];
  const store={async command(a:string){actions.push(a);if(a==="REAP_CLAIM")return done?null:record;if(a==="REAP_DONE")done=true;}};
  await new CleanupReaper(store,{async command(){}},async()=>{throw new Error("outage");}).tick();assert.equal(done,false);assert.ok(actions.includes("REAP_FAILED"));
  await new CleanupReaper(store,{async command(){}},async()=>{}).tick();assert.equal(done,true);assert.equal(await new CleanupReaper(store,{async command(){}},async()=>{}).tick(),false);
});
test("Phase 10 executable local worker selection fails closed in staging and production",()=>{
  for(const environment of ["staging","production"])assert.throws(()=>requireLocalEnvironment({LAUNCHGATE_ENVIRONMENT:environment}));
  assert.throws(()=>requireLocalEnvironment({NODE_ENV:"production"}));assert.throws(()=>executionEnvironment({LAUNCHGATE_ENVIRONMENT:"unknown"}));
  requireLocalEnvironment({LAUNCHGATE_ENVIRONMENT:"test"});assert.equal(localQualificationReport().readiness.productionReady,false);
});
for(const failure of ["heartbeat","memory","disk","deadline","revocation"] as const)test(`Phase 10 supervisor ${failure} failure expires and destroys only owned attempt`,async()=>{
 const {p,calls}=sandboxFixture(),s=scope(),actions:string[]=[];
 const provider={...p,async heartbeat(){return{alive:failure!=="heartbeat"};},async getUsage(){return{cpuMillis:1,memoryBytes:failure==="memory"?1e10:1,diskBytes:failure==="disk"?1e10:1};}};
 const supervisor=new SandboxSupervisor(provider,{async command(a){actions.push(a);}},async()=>{if(failure==="revocation")throw new Error("revoked");});
 assert.equal(await supervisor.check({id:randomUUID(),scope:s,provider:p.name,kind:"SANDBOX",externalId:scopeKey(s),expiresAt:new Date(Date.now()+(failure==="deadline"?-100:10000)).toISOString(),fence:1}),"INCONCLUSIVE");
 assert.deepEqual(actions,["EXPIRE","DESTROYED"]);assert.deepEqual(calls,["terminate","destroy"]);
});
test("Phase 10 database interruption prevents sandbox creation and secret delivery",async()=>{
 const {p,calls}=sandboxFixture(),g=grantFixture();g.runner.imageDigest=`sha256:${"a".repeat(64)}`;
 const runner=new ProductionSandboxRunner(p,{async command(){throw new Error("DB unavailable");}},{verify:()=>g},"staging",async()=>{},new Observer(async()=>{}));
 await assert.rejects(()=>runner.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:"test",deadline:new Date(g.exp*1000).toISOString()}));assert.deepEqual(calls,[]);
});
test("Phase 10 cleanup refuses ambiguous sandbox identity and cross-environment ownership",async()=>{
 const {p,calls}=sandboxFixture(),s=scope(),secrets=new LocalTestSecretStore();
 const objects:PrivateObjectBackend={kind:"local-test",private:true,encryption:"PROVIDER_KMS",async putIfAbsent(){throw new Error();},async deletePrefix(){throw new Error();},async signedDownload(){throw new Error();}};
 const clean=resourceCleaner("test",p,secrets,objects),record={id:randomUUID(),scope:s,kind:"SANDBOX" as const,provider:p.name,externalId:"unrelated",expiresAt:new Date().toISOString(),fence:1};
 await assert.rejects(()=>clean(record));await assert.rejects(()=>clean({...record,scope:{...s,environment:"production"}}));assert.deepEqual(calls,[]);await clean({...record,externalId:scopeKey(s)});assert.deepEqual(calls,["terminate","destroy"]);secrets.dispose();
});
test("Phase 10 credential revocation intent is durable before material delivery",async()=>{
 const {p}=sandboxFixture(),s=scope(),secrets=new LocalTestSecretStore(),reference=await secrets.put(s,"TARGET_SESSION",Buffer.from("scoped-test")),order:string[]=[];
 const provider={...p,async injectScopedCredential(_id:string,name:string){assert.equal(name,"target-session");order.push("inject");}};
 await scopedCredentialDelivery(provider,new CredentialBroker(secrets,async()=>{}),{async command(action){order.push(action);}},async()=>reference)(s,scopeKey(s),Date.now()+10000);
 assert.deepEqual(order,["REGISTER","inject"]);assert.equal(secrets.activeLeases,0);secrets.dispose();
});
test("Phase 10 mismatched attestation prevents credential injection",async()=>{
 const {p,calls}=sandboxFixture(),g=grantFixture();g.runner.imageDigest=`sha256:${"a".repeat(64)}`;
 const provider={...p,async getAttestationMetadata(id:string){return{...await p.getAttestationMetadata(id),policyDigest:`sha256:${"f".repeat(64)}`};}};
 const runner=new ProductionSandboxRunner(provider,{async command(){}},{verify:()=>g},"staging",async()=>{},new Observer(async()=>{}));
 await assert.rejects(()=>runner.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:"test",deadline:new Date(g.exp*1000).toISOString()}));assert.equal(calls.includes("inject"),false);
});
test("Phase 10 hung provider operation times out without replaying unkeyed side effects",async()=>{
 let calls=0;const circuit=new ProviderCircuit();
 await assert.rejects(()=>circuit.execute(()=>{calls++;return new Promise<never>(()=>{});},{idempotent:false,timeoutMs:10}),error=>error instanceof ProviderFailure&&error.code==="TIMEOUT");assert.equal(calls,1);
});
test("Phase 10 runtime qualification reader enforces tenant/environment and fresh degraded status",async()=>{
 const org=randomUUID(),row={organization_id:org,environment:"production",capability:"sandbox.production",status:"DEGRADED",evidence_digest:null,live:false,observed_at:new Date(Date.now()-1).toISOString(),expires_at:new Date(Date.now()+10000).toISOString()};
 const reader=qualificationReader({async command(){return[row];}},org,"production");assert.equal(capabilityRegistry("production",await reader())["sandbox.production"],"DEGRADED");
 await assert.rejects(()=>qualificationReader({async command(){return[{...row,organization_id:randomUUID()}];}},org,"production")());
 await assert.rejects(()=>qualificationReader({async command(){throw new Error("database offline");}},org,"production")());
});
