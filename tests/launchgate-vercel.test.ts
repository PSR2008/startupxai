import { test } from "node:test";
import assert from "node:assert/strict";
import { VercelProvider,type VercelConnection } from "../src/server/vercel/provider";
const connection:VercelConnection={organizationId:"org",projectId:"project",accountId:"team_fixture",providerProjectId:"prj_fixture",status:"ACTIVE",token:"test-token-no-live-provider"};
const input={organizationId:"org",projectId:"project",deploymentId:"dpl_fixture",commitSha:"a".repeat(40),repositoryId:123};
const metadata={id:"dpl_fixture",url:"project-immutable123.vercel.app",projectId:"prj_fixture",ownerId:"team_fixture",readyState:"READY",target:null,gitSource:{type:"github",sha:"a".repeat(40),repoId:123},alias:["movable.vercel.app"]};
function mock(overrides:Record<string,unknown>={}):typeof fetch{return async(url,options)=>{const u=new URL(String(url));assert.equal(u.origin,"https://api.vercel.com");assert.equal(options?.redirect,"error");assert.equal(u.searchParams.get("teamId"),"team_fixture");return Response.json(u.pathname.startsWith("/v2/")?{id:"team_fixture",membership:{role:"OWNER",confirmed:true}}:u.pathname.startsWith("/v9/")?{id:"prj_fixture",accountId:"team_fixture"}:{...metadata,...overrides});};}
test("Vercel stable deployment ID selects generated URL, never movable alias",async()=>{const r=await new VercelProvider(connection,mock()).verify(input);assert.equal(r.targetUrl,"https://project-immutable123.vercel.app/");assert.equal(r.providerDeploymentId,"dpl_fixture");});
for(const [name,override] of Object.entries({commit:{gitSource:{...metadata.gitSource,sha:"b".repeat(40)}},repository:{gitSource:{...metadata.gitSource,repoId:456}},project:{projectId:"prj_other"},owner:{ownerId:"team_other"},identity:{id:"dpl_other"},production:{target:"production"},customAlias:{url:"customer.example.com"},missingOwnership:{ownerId:undefined}}))
 test(`Vercel rejects ${name} mismatch`,async()=>assert.rejects(()=>new VercelProvider(connection,mock(override)).verify(input)));
test("Vercel revoked connection and wrong LaunchGate tenant fail before provider call",async()=>{let called=false;const fetcher:typeof fetch=async()=>{called=true;throw new Error();};await assert.rejects(()=>new VercelProvider({...connection,status:"REVOKED"},fetcher).verify(input));await assert.rejects(()=>new VercelProvider(connection,fetcher).verify({...input,organizationId:"other"}));assert.equal(called,false);});
test("Vercel movable hostname cannot be supplied as stable deployment ID",async()=>assert.rejects(()=>new VercelProvider(connection,mock()).verify({...input,deploymentId:"movable.vercel.app"})));
test("Vercel project read access alone does not prove ownership",async()=>{
 const readOnly:typeof fetch=async()=>Response.json({id:"team_fixture",membership:{role:"VIEWER",confirmed:true}});
 await assert.rejects(()=>new VercelProvider(connection,readOnly).verify(input));
});
