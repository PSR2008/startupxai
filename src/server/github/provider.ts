import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";
import { type GitHubConfig } from "./config";
import { ApiError } from "../http/api-error";
import { ingest } from "@launchgate/source-analysis";

const id=z.number().int().positive().safe();
const segment=z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/);
const repositorySchema=z.object({id,owner:z.object({login:segment}),name:segment,private:z.boolean(),visibility:z.enum(["public","private","internal"]).optional(),default_branch:z.string().min(1).max(255),permissions:z.object({admin:z.boolean()}).optional()});
const installationSchema=z.object({id,app_id:id,account:z.object({id}),suspended_at:z.string().nullable(),permissions:z.record(z.string())});
const sha=z.string().regex(/^[a-f0-9]{40}$/);
export type VerifiedRepository={appId:number;installationId:number;accountId:number;repositoryId:number;owner:string;name:string;visibility:string;defaultBranch:string};
export async function boundedBody(response:Response,max:number):Promise<Uint8Array> {
  if(!response.body)throw new ApiError("INVALID_REQUEST");
  const reader=response.body.getReader();let size=0;const parts:Uint8Array[]=[];
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError("INVALID_REQUEST");}parts.push(value);}return Buffer.concat(parts);}
  finally{reader.releaseLock();}
}
export function appJwt(config:GitHubConfig,now=Date.now()) {
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const input=`${encode({alg:"RS256",typ:"JWT"})}.${encode({iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+480,iss:String(config.appId)})}`;
  return `${input}.${createSign("RSA-SHA256").update(input).sign(config.privateKey,"base64url")}`;
}
export class GitHubProvider {
  constructor(private readonly config:GitHubConfig,private readonly transport:typeof fetch=fetch){}
  authorizationUrl(state:string) {
    const url=new URL("https://github.com/login/oauth/authorize");url.searchParams.set("client_id",this.config.clientId);url.searchParams.set("redirect_uri",this.config.redirectUri);url.searchParams.set("state",state);return url.toString();
  }
  private async request(path:string,token:string,body?:unknown,signal?:AbortSignal,method?:"PATCH"):Promise<unknown> {
    if(!path.startsWith("/")||path.startsWith("//"))throw new ApiError("ACCESS_DENIED");
    const url=new URL(path,"https://api.github.com");if(url.origin!=="https://api.github.com")throw new ApiError("ACCESS_DENIED");
    const response=await this.transport(url,{method:method??(body===undefined?"GET":"POST"),redirect:"error",signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok){await response.body?.cancel();throw new ApiError("ACCESS_DENIED");}
    try{return JSON.parse(Buffer.from(await boundedBody(response,2097152)).toString("utf8"));}catch{throw new ApiError("INVALID_REQUEST");}
  }
  private async installation(installationId:number,signal?:AbortSignal) {
    const data=installationSchema.parse(await this.request(`/app/installations/${id.parse(installationId)}`,appJwt(this.config),undefined,signal));
    if(data.id!==installationId||data.app_id!==this.config.appId||data.suspended_at!==null||data.permissions.contents!=="read"||Object.entries(data.permissions).some(([key,value])=>key==="checks"?value!=="write":!["metadata","contents"].includes(key)||value!=="read"))throw new ApiError("ACCESS_DENIED");
    return data;
  }
  // Caller holds the durable publication lease. Reconcile by stable external_id
  // after an uncertain POST; GitHub does not offer an idempotency-key header.
  async publishCheck(input:{installationId:number;repositoryId:number;headSha:string;externalId:string;conclusion:"success"|"failure"|"action_required";title:string;summary:string},checkpoint:()=>Promise<void>) {
    const parsed=z.object({installationId:id,repositoryId:id,headSha:sha,externalId:z.string().regex(/^lg:[a-f0-9-]{36}:[a-f0-9]{40}$/),conclusion:z.enum(["success","failure","action_required"]),title:z.string().max(100),summary:z.string().max(10000)}).strict().parse(input);
    const signal=AbortSignal.timeout(30000);await checkpoint();
    const installation=await this.installation(parsed.installationId,signal);
    if(installation.permissions.checks!=="write")throw new ApiError("ACCESS_DENIED");
    const access=z.object({token:z.string().min(10).max(4096),expires_at:z.string().datetime()}).parse(await this.request(`/app/installations/${parsed.installationId}/access_tokens`,appJwt(this.config),{repository_ids:[parsed.repositoryId],permissions:{checks:"write",metadata:"read"}},signal));
    if(Date.parse(access.expires_at)<=Date.now()||Date.parse(access.expires_at)>Date.now()+3700000)throw new ApiError("ACCESS_DENIED");
    const repo=repositorySchema.parse(await this.request(`/repositories/${parsed.repositoryId}`,access.token,undefined,signal));
    if(repo.id!==parsed.repositoryId)throw new ApiError("ACCESS_DENIED");
    const base=`/repos/${repo.owner.login}/${repo.name}`;
    const check=z.object({id,head_sha:sha,external_id:z.string().nullable(),app:z.object({id})});
    const matches:Array<z.infer<typeof check>>=[];
    for(let page=1;page<=10;page++){
      await checkpoint();
      const list=z.object({total_count:z.number().int().nonnegative(),check_runs:z.array(check).max(100)}).parse(await this.request(`${base}/commits/${parsed.headSha}/check-runs?check_name=LaunchGate%20Release%20Gate&filter=all&per_page=100&page=${page}`,access.token,undefined,signal));
      matches.push(...list.check_runs.filter(c=>c.external_id===parsed.externalId&&c.head_sha===parsed.headSha&&c.app.id===this.config.appId));
      if(list.total_count<=page*100)break;
      if(page===10)throw new ApiError("ACCESS_DENIED");
    }
    if(matches.length>1)throw new ApiError("ACCESS_DENIED");
    const body={name:"LaunchGate Release Gate",external_id:parsed.externalId,status:"completed",conclusion:parsed.conclusion,output:{title:parsed.title,summary:parsed.summary}};
    await checkpoint();
    const result=check.parse(await this.request(matches.length?`${base}/check-runs/${matches[0].id}`:`${base}/check-runs`,access.token,matches.length?body:{...body,head_sha:parsed.headSha},signal,matches.length?"PATCH":undefined));
    if(result.head_sha!==parsed.headSha||result.external_id!==parsed.externalId||result.app.id!==this.config.appId)throw new ApiError("ACCESS_DENIED");
    return {checkId:result.id,headSha:result.head_sha};
  }
  async verifyConnection(code:string,installationId:number,repositoryId:number):Promise<VerifiedRepository> {
    const signal=AbortSignal.timeout(30000);
    const response=await this.transport("https://github.com/login/oauth/access_token",{method:"POST",redirect:"error",signal,headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:this.config.clientId,client_secret:this.config.clientSecret,code,redirect_uri:this.config.redirectUri})});
    if(!response.ok){await response.body?.cancel();throw new ApiError("ACCESS_DENIED");}
    const token=z.object({access_token:z.string().min(10).max(4096)}).parse(JSON.parse(Buffer.from(await boundedBody(response,16384)).toString("utf8"))).access_token;
    let found=false;
    for(let page=1;page<=10;page++) {
      const data=z.object({installations:z.array(z.object({id}))}).parse(await this.request(`/user/installations?per_page=100&page=${page}`,token,undefined,signal));
      if(data.installations.some(i=>i.id===installationId)){found=true;break;}if(data.installations.length<100)break;
    }
    if(!found)throw new ApiError("ACCESS_DENIED");
    const installation=await this.installation(installationId,signal);
    let repository:z.infer<typeof repositorySchema>|undefined;
    for(let page=1;page<=10;page++) {
      const data=z.object({repositories:z.array(repositorySchema)}).parse(await this.request(`/user/installations/${id.parse(installationId)}/repositories?per_page=100&page=${page}`,token,undefined,signal));
      repository=data.repositories.find(r=>r.id===repositoryId);if(repository||data.repositories.length<100)break;
    }
    if(!repository)throw new ApiError("ACCESS_DENIED");
    const checked=repositorySchema.parse(await this.request(`/repos/${repository.owner.login}/${repository.name}`,token,undefined,signal));
    if(checked.id!==repositoryId||!checked.permissions?.admin)throw new ApiError("ACCESS_DENIED");
    return {appId:this.config.appId,installationId,accountId:installation.account.id,repositoryId,owner:checked.owner.login,name:checked.name,visibility:(checked.visibility??(checked.private?"private":"public")).toUpperCase(),defaultBranch:checked.default_branch};
  }
  async ingestCommit(installationId:number,repositoryId:number,commitSha:string,root:string,checkpoint?:()=>Promise<void>) {
    sha.parse(commitSha);id.parse(repositoryId);const signal=AbortSignal.timeout(30000);
    await checkpoint?.();
    await this.installation(installationId,signal);
    const access=z.object({token:z.string().min(10).max(4096),expires_at:z.string().datetime()}).parse(await this.request(`/app/installations/${installationId}/access_tokens`,appJwt(this.config),{repository_ids:[repositoryId],permissions:{contents:"read",metadata:"read"}},signal));
    if(Date.parse(access.expires_at)<=Date.now()||Date.parse(access.expires_at)>Date.now()+3700000)throw new ApiError("ACCESS_DENIED");
    const read=async(path:string)=>{await checkpoint?.();return this.request(path,access.token,undefined,signal);};
    const repo=repositorySchema.parse(await read(`/repositories/${repositoryId}`));
    if(repo.id!==repositoryId)throw new ApiError("ACCESS_DENIED");
    const base=`/repos/${repo.owner.login}/${repo.name}/git`;
    const commit=z.object({sha,tree:z.object({sha})}).parse(await read(`${base}/commits/${commitSha}`));
    if(commit.sha!==commitSha)throw new ApiError("ACCESS_DENIED");
    const tree=z.object({sha,truncated:z.boolean(),tree:z.array(z.object({path:z.string().max(4096),mode:z.string(),type:z.string(),sha,size:z.number().int().nonnegative().optional()})).max(2000)}).parse(await read(`${base}/trees/${commit.tree.sha}?recursive=1`));
    if(tree.sha!==commit.tree.sha)throw new ApiError("ACCESS_DENIED");
    const source=await ingest(tree.tree,async(blobSha:string,max:number)=>{
      const blob=z.object({sha,encoding:z.literal("base64"),content:z.string().max(100000),size:z.number().int().max(max)}).parse(await read(`${base}/blobs/${blobSha}`));
      if(blob.sha!==blobSha||!/^[A-Za-z0-9+/=\r\n]*$/.test(blob.content))throw new ApiError("INVALID_REQUEST");
      const bytes=Buffer.from(blob.content.replace(/\s/g,""),"base64");if(bytes.length!==blob.size)throw new ApiError("INVALID_REQUEST");return bytes;
    },{root,truncated:tree.truncated});
    return {commitSha,treeSha:tree.sha,source};
  }
}
