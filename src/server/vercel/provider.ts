import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { boundedBody } from "../github/provider";
import { targetUrl } from "../../../services/runner/target";

export interface VercelConnection {organizationId:string;projectId:string;accountId:string;providerProjectId:string;status:"ACTIVE"|"REVOKED";token:string}
const identifier=z.string().regex(/^[A-Za-z0-9_]{1,100}$/);
export class VercelProvider {
 constructor(private readonly connection:VercelConnection,private readonly fetcher:typeof fetch=fetch){}
 private async read(path:string) {
  const c=this.connection;if(c.status!=="ACTIVE"||!c.token||c.token.startsWith("vcn_"))throw new Error("VERCEL_CONNECTION_DENIED");
  identifier.parse(c.accountId);identifier.parse(c.providerProjectId);
  const url=new URL(`https://api.vercel.com${path}`);url.searchParams.set("teamId",c.accountId);url.searchParams.set("withGitRepoInfo","true");
  const response=await this.fetcher(url,{headers:{Authorization:`Bearer ${c.token}`},redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error("VERCEL_UNAVAILABLE");
  return JSON.parse(Buffer.from(await boundedBody(response,1048576)).toString("utf8"));
 }
 async verify(input:{organizationId:string;projectId:string;deploymentId:string;commitSha:string;repositoryId:number}) {
  const c=this.connection;
  if(input.organizationId!==c.organizationId||input.projectId!==c.projectId||!/^dpl_[A-Za-z0-9]+$/.test(input.deploymentId))throw new Error("VERCEL_SCOPE");
  // A successful project read with accountId is required; a public deployment
  // response or repository access alone is not accepted as ownership proof.
  const team=z.object({id:z.string(),membership:z.object({role:z.literal("OWNER"),confirmed:z.literal(true)})}).parse(await this.read(`/v2/teams/${c.accountId}`));
  if(team.id!==c.accountId)throw new Error("VERCEL_OWNERSHIP");
  const p=z.object({id:z.string(),accountId:z.string()}).parse(await this.read(`/v9/projects/${c.providerProjectId}`));
  const d=z.object({id:z.string(),url:z.string(),projectId:z.string(),ownerId:z.string(),readyState:z.literal("READY"),target:z.union([z.null(),z.literal("staging")]),
   gitSource:z.object({type:z.literal("github"),sha:z.string().regex(/^[a-f0-9]{40}$/),repoId:z.union([z.number().int(),z.string().regex(/^\d+$/)])})}).parse(await this.read(`/v13/deployments/${input.deploymentId}`));
  if(p.id!==c.providerProjectId||p.accountId!==c.accountId||d.id!==input.deploymentId||d.projectId!==p.id||d.ownerId!==p.accountId||d.gitSource.sha!==input.commitSha||String(d.gitSource.repoId)!==String(input.repositoryId))throw new Error("VERCEL_BINDING");
  const u=targetUrl(`https://${d.url}/`);if(!/^[a-z0-9-]+\.vercel\.app$/.test(u.hostname))throw new Error("VERCEL_IMMUTABLE_HOST");
  const verified={providerDeploymentId:d.id,targetUrl:u.href,commitSha:d.gitSource.sha};
  return {...verified,proofDigest:createHash("sha256").update(JSON.stringify({...verified,accountId:p.accountId,projectId:p.id})).digest("hex")};
 }
}
