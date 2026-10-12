import { isIP, BlockList } from "node:net";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { ExecutionGrant } from "@launchgate/contracts";

const denied=new BlockList();
for(const [ip,bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const)denied.addSubnet(ip,bits,"ipv4");
// Conservative IPv6: only native global unicast, excluding transition/special ranges.
for(const [ip,bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const)denied.addSubnet(ip,bits,"ipv6");
export function publicAddress(ip:string):boolean {
 const type=isIP(ip);if(type===4)return !denied.check(ip,"ipv4");
 return type===6&&/^[23][0-9a-f]{3}:/i.test(ip)&&!denied.check(ip,"ipv6");
}
export function targetUrl(value:string,host?:string):URL {
 if(value.length>2048||/[\\\s]/.test(value))throw new Error("TARGET_SCOPE");
 const u=new URL(value);
 if(u.protocol!=="https:"||u.username||u.password||u.hash||u.port&&u.port!=="443"||
  !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(u.hostname)||
  isIP(u.hostname)||u.hostname.endsWith(".localhost")||u.hostname.endsWith(".local")||u.hostname==="metadata.google.internal"||
  u.hostname.split(".").some(x=>x.startsWith("xn--"))||host&&u.hostname!==host)throw new Error("TARGET_SCOPE");
 return u;
}
export type Address={address:string;family:number};
export type Transport=(url:URL,address:Address,headers:Record<string,string>,signal:AbortSignal,maxBytes:number)=>Promise<{status:number;location?:string;bytes:number}>;
export const pinnedHttps:Transport=(url,address,headers,signal,maxBytes)=>new Promise((resolve,reject)=>{
 // Pin the checked address on the actual connection. No second DNS resolution,
 // proxy environment support, cookies, redirect following or connection reuse.
 const req=request(url,{method:"GET",agent:false,headers,signal,servername:url.hostname,family:address.family,
  lookup:(_host,_options,callback)=>callback(null,address.address,address.family)},res=>{
  let bytes=0;
  res.on("data",chunk=>{bytes+=chunk.length;if(bytes>maxBytes)req.destroy(new Error("RESPONSE_LIMIT"));});
  res.on("error",reject);res.on("end",()=>resolve({status:res.statusCode??0,location:res.headers.location,bytes}));
 });req.on("error",reject);req.end();
});
export class TargetClient {
 private count=0;private active=0;private tokens=5;private updated=Date.now();
 constructor(private readonly grant:ExecutionGrant,private readonly check:()=>Promise<void>,
  private readonly resolve:(host:string)=>Promise<Address[]>=host=>lookup(host,{all:true,verbatim:true}),
  private readonly transport:Transport=pinnedHttps,private readonly bypass?:{host:string;secret:string}){}
 async get(value:string,signal:AbortSignal):Promise<{status:number;bytes:number}> {
  const g=this.grant;const u=targetUrl(value,g.authorization.targetHost);
  if(!g.authorization.allowedOperations.includes("resource.read")||g.paymentMode!=="TEST_ONLY"||g.limits.spendMicros!==0)throw new Error("OPERATION_SCOPE");
  const now=Date.now();this.tokens=Math.min(5,this.tokens+(now-this.updated)/500);this.updated=now;
  if(signal.aborted||now>=g.exp*1000||now>=Date.parse(g.authorization.expiresAt))throw new Error("STOP_REQUIRED");
  if(this.active>=g.limits.concurrency||this.count>=g.limits.requests||this.tokens<1)throw new Error("REQUEST_LIMIT");
  this.active++;this.tokens--;this.count++;
  try {
   const bounded=AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(5000,g.exp*1000-now)))]);
   const addresses=await Promise.race([this.resolve(u.hostname),new Promise<never>((_,reject)=>bounded.addEventListener("abort",()=>reject(new Error("TIMEOUT")),{once:true}))]);
   if(!addresses.length||addresses.some(a=>!publicAddress(a.address)||isIP(a.address)!==a.family))throw new Error("PRIVATE_DESTINATION");
   await this.check(); // Durable authorization/fencing/request consumption immediately before I/O.
   bounded.throwIfAborted();
   const headers:Record<string,string>={accept:"text/html,application/json"};
   if(this.bypass){if(this.bypass.host!==u.hostname)throw new Error("CREDENTIAL_SCOPE");headers["x-vercel-protection-bypass"]=this.bypass.secret;}
   const result=await this.transport(u,addresses[0],headers,bounded,g.limits.responseBytes);
   if(result.bytes>g.limits.responseBytes)throw new Error("RESPONSE_LIMIT");
   if(result.status>=300&&result.status<400){
    if(result.location)targetUrl(new URL(result.location,u).href,u.hostname);
    throw new Error("REDIRECT_STOP"); // Fail closed even for same-host redirects in Phase 4.
   }
   return result;
  } finally {this.active--;}
 }
}
