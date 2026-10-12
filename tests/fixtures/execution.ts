import { randomUUID } from "node:crypto";
import { executionGrantSchema,type ExecutionGrant } from "@launchgate/contracts";
export function grantFixture(overrides:Partial<ExecutionGrant>={}):ExecutionGrant {
 const organizationId=randomUUID(),projectId=randomUUID(),authorizationId=randomUUID();
 return executionGrantSchema.parse({iss:"launchgate-orchestrator",aud:"launchgate-runner",jti:randomUUID(),iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,
 jobId:randomUUID(),attemptId:randomUUID(),fence:1,runId:randomUUID(),organizationId,projectId,snapshotId:randomUUID(),commitSha:"a".repeat(40),deploymentId:randomUUID(),deploymentUrl:"https://fixture-hash.vercel.app/",authorizationId,authorizationVersion:1,
 authorization:{id:authorizationId,organizationId,projectId,targetHost:"fixture-hash.vercel.app",method:"PROVIDER_OWNERSHIP_VERIFICATION",proofReference:randomUUID(),authorizingPrincipal:{userId:randomUUID(),origin:"supabase_verified_bearer"},allowedHosts:["fixture-hash.vercel.app"],allowedPorts:[443],allowedOperations:["resource.read"],startsAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),requestLimit:10,requestsPerSecond:2,concurrencyLimit:1,spendLimit:{currency:"USD",micros:0},revocation:{state:"ACTIVE"}},
 runner:{identity:randomUUID(),version:"lg-runner-1",imageDigest:null},policyVersion:1,invariantVersions:[],limits:{requests:10,concurrency:1,durationSeconds:60,responseBytes:1024,artifactBytes:4096,spendMicros:0,requestsPerSecond:2,burst:5},paymentMode:"TEST_ONLY",dataPolicy:"REDACTED_ONLY",...overrides});
}
