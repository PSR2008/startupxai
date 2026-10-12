import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer,get } from "node:http";
import { publicAddress,targetUrl,TargetClient,type Transport } from "../services/runner/target";
import { grantFixture } from "./fixtures/execution";
const dns=async()=>[{address:"93.184.216.34",family:4}];
const ok:Transport=async()=>({status:200,bytes:5});
for(const ip of ["127.0.0.1","::1","169.254.169.254","10.2.3.4","172.16.1.1","192.168.1.1","fc00::1","fd12::1","fe80::1","::ffff:127.0.0.1","::ffff:8.8.8.8","2002:7f00:1::","2001:db8::1","0.0.0.0","100.64.0.1","224.0.0.1"])
 test(`target address rejects ${ip}`,()=>assert.equal(publicAddress(ip),false));
test("global native IPv4 and IPv6 accepted",()=>{assert.equal(publicAddress("8.8.8.8"),true);assert.equal(publicAddress("2606:4700:4700::1111"),true);});
for(const url of ["http://fixture-hash.vercel.app/","https://localhost/","https://127.0.0.1/","https://[::1]/","https://fixture-hash.vercel.app:444/","https://user:password@fixture-hash.vercel.app/","https://metadata.google.internal/","https://fixture-hash.vercel.app\\@evil.com/","https://evil.com/","https://fixture-hash.vercel.app/#secret"])
 test(`target URL rejects ${url}`,()=>assert.throws(()=>targetUrl(url,"fixture-hash.vercel.app")));
test("exact host invokes authorization immediately before pinned transport",async()=>{
 const events:string[]=[];const c=new TargetClient(grantFixture(),async()=>{events.push("authorization");},async()=>{events.push("dns");return dns();},async(_u,address)=>{events.push(address.address);return {status:200,bytes:1};});
 await c.get("https://fixture-hash.vercel.app/",new AbortController().signal);assert.deepEqual(events,["dns","authorization","93.184.216.34"]);
});
test("DNS rebinding and mixed private answers cannot reach transport",async()=>{
 let calls=0,resolutions=0;const c=new TargetClient(grantFixture(),async()=>{},async()=>++resolutions===1?dns():[{address:"127.0.0.1",family:4}],async()=>{calls++;return {status:200,bytes:1};});
 await c.get("https://fixture-hash.vercel.app/",new AbortController().signal);await assert.rejects(()=>c.get("https://fixture-hash.vercel.app/",new AbortController().signal));assert.equal(calls,1);
 const mixed=new TargetClient(grantFixture(),async()=>{},async()=>[...(await dns()),{address:"10.0.0.1",family:4}],ok);await assert.rejects(()=>mixed.get("https://fixture-hash.vercel.app/",new AbortController().signal));
});
for(const location of ["https://evil.com/","https://127.0.0.1/","https://[::1]/","/same-host"])
 test(`redirect stops without forwarding credentials: ${location}`,async()=>{
 let count=0;const c=new TargetClient(grantFixture(),async()=>{},dns,async(u,_a,headers)=>{count++;assert.equal(u.search,"");assert.equal(headers["x-vercel-protection-bypass"],"test-secret");return {status:302,location,bytes:0};},{host:"fixture-hash.vercel.app",secret:"test-secret"});
 await assert.rejects(()=>c.get("https://fixture-hash.vercel.app/",new AbortController().signal));assert.equal(count,1);
});
test("response ceiling and request ceiling stop execution",async()=>{
 const g=grantFixture();g.limits.requests=1;const c=new TargetClient(g,async()=>{},dns,async()=>({status:200,bytes:2048}));
 await assert.rejects(()=>c.get(g.deploymentUrl,new AbortController().signal),/RESPONSE_LIMIT/);await assert.rejects(()=>c.get(g.deploymentUrl,new AbortController().signal),/REQUEST_LIMIT/);
});
test("authorization loss, cancellation, grant expiry, live payment and spend stop",async()=>{
 const g=grantFixture();const c=new TargetClient(g,async()=>{throw new Error("REVOKED");},dns,ok);await assert.rejects(()=>c.get(g.deploymentUrl,new AbortController().signal),/REVOKED/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>c.get(g.deploymentUrl,aborted.signal),/STOP_REQUIRED/);
 g.exp=0;await assert.rejects(()=>c.get(g.deploymentUrl,new AbortController().signal),/STOP_REQUIRED/);
 const invalid=grantFixture();Object.assign(invalid,{paymentMode:"LIVE"});await assert.rejects(()=>new TargetClient(invalid,async()=>{},dns,ok).get(invalid.deploymentUrl,new AbortController().signal),/OPERATION_SCOPE/);
});
test("concurrent requests cannot exceed grant ceiling",async()=>{
 let finish!:()=>void;const c=new TargetClient(grantFixture(),async()=>{},dns,async()=>{await new Promise<void>(r=>{finish=r;});return {status:200,bytes:1};});
 const first=c.get("https://fixture-hash.vercel.app/",new AbortController().signal);await new Promise(r=>setImmediate(r));await assert.rejects(()=>c.get("https://fixture-hash.vercel.app/",new AbortController().signal),/REQUEST_LIMIT/);finish();await first;
});
test("stalled DNS resolution stops at the grant deadline",async()=>{
 const g=grantFixture();g.exp=Math.floor(Date.now()/1000)+1;
 const c=new TargetClient(g,async()=>{},()=>new Promise(()=>{}),ok);
 await assert.rejects(()=>c.get(g.deploymentUrl,new AbortController().signal),/TIMEOUT/);
});
test("authorization expiry and out-of-scope bypass credential stop before I/O",async()=>{
 const g=grantFixture();g.authorization.expiresAt=new Date(Date.now()-1).toISOString();await assert.rejects(()=>new TargetClient(g,async()=>{},dns,ok).get(g.deploymentUrl,new AbortController().signal),/STOP_REQUIRED/);
 const fresh=grantFixture();await assert.rejects(()=>new TargetClient(fresh,async()=>{},dns,ok,{host:"other.vercel.app",secret:"secret"}).get(fresh.deploymentUrl,new AbortController().signal),/CREDENTIAL_SCOPE/);
});
test("synthetic local server transport receives one scoped request only",async()=>{
 let requests=0;const server=createServer((_req,res)=>{requests++;res.end("synthetic");});await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
 const address=server.address();assert.ok(address&&typeof address!=="string");
 // Test-only capability deliberately maps the already checked public fixture
 // address to our local server. No production flag permits private addresses.
 const transport:Transport=async(_u,_a,_h,signal,max)=>new Promise((resolve,reject)=>{get(`http://127.0.0.1:${address.port}/`,{signal},res=>{let bytes=0;res.on("data",c=>{bytes+=c.length;if(bytes>max)res.destroy(new Error("LIMIT"));});res.on("end",()=>resolve({status:res.statusCode!,bytes}));res.on("error",reject);}).on("error",reject);});
 try{const g=grantFixture();assert.equal((await new TargetClient(g,async()=>{},dns,transport).get(g.deploymentUrl,new AbortController().signal)).status,200);assert.equal(requests,1);}finally{await new Promise<void>((r,e)=>server.close(err=>err?e(err):r()));}
});
