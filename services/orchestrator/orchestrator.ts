import { randomUUID,type KeyObject } from "node:crypto";
import { z } from "zod";
import { executionGrantSchema,type ExecutionGrant } from "@launchgate/contracts";
import { signGrant } from "../runner/grant";
import { targetUrl } from "../runner/target";
import type { ExecutionStore } from "./store";
import type { ArtifactStore } from "./artifacts";

export interface RunnerProvider {
 // Must be idempotent by attemptId across orchestrator restarts. Enforce the
 // deadline externally, default-deny egress except the scoped target/control
 // endpoint, sanitized environment, and no customer repository execution.
 launch(input:{attemptId:string;runnerId:string;grant:string;deadline:string}):Promise<void>;
 terminate(attemptId:string):Promise<void>;
 // Resolve only after termination is confirmed and execution resources removed.
 cleanup(attemptId:string):Promise<void>;
}
const uuid=z.string().uuid();
const claimSchema=z.object({
 run:z.object({id:uuid,organization_id:uuid,project_id:uuid,snapshot_id:uuid,commit_sha:z.string(),deployment_id:uuid,authorization_id:uuid,authorization_version:z.number(),runner_image_digest:z.string().nullable()}),
 job:z.object({id:uuid,fence:z.number()}),
 attempt:z.object({id:uuid,runner_id:uuid,grant_id:uuid,deadline:z.string(),reserved_requests:z.number(),reserved_concurrency:z.number()}),
 authorization:z.object({id:uuid,principal_id:uuid,proof_id:uuid,starts_at:z.string(),expires_at:z.string(),request_limit:z.number(),concurrency_limit:z.number(),duration_seconds:z.number()}),
 deployment:z.object({target_url:z.string()}),invariants:z.array(z.object({id:uuid,version:z.number()})),
});
export function grantFromClaim(input:unknown,now=Date.now()):ExecutionGrant {
 const c=claimSchema.parse(input),r=c.run,a=c.authorization,t=c.attempt;const u=targetUrl(c.deployment.target_url);
 return executionGrantSchema.parse({iss:"launchgate-orchestrator",aud:"launchgate-runner",jti:t.grant_id,iat:Math.floor(now/1000),exp:Math.floor(Date.parse(t.deadline)/1000),
  jobId:c.job.id,attemptId:t.id,fence:c.job.fence,runId:r.id,organizationId:r.organization_id,projectId:r.project_id,snapshotId:r.snapshot_id,commitSha:r.commit_sha,
  deploymentId:r.deployment_id,deploymentUrl:u.href,authorizationId:r.authorization_id,authorizationVersion:r.authorization_version,
  authorization:{id:a.id,organizationId:r.organization_id,projectId:r.project_id,targetHost:u.hostname,method:"PROVIDER_OWNERSHIP_VERIFICATION",proofReference:a.proof_id,
   authorizingPrincipal:{userId:a.principal_id,origin:"supabase_verified_bearer"},allowedHosts:[u.hostname],allowedPorts:[443],allowedOperations:["resource.read"],
   startsAt:new Date(a.starts_at).toISOString(),expiresAt:new Date(a.expires_at).toISOString(),requestLimit:a.request_limit,requestsPerSecond:2,concurrencyLimit:a.concurrency_limit,
   spendLimit:{currency:"USD",micros:0},revocation:{state:"ACTIVE"}},runner:{identity:t.runner_id,version:"lg-runner-1",imageDigest:r.runner_image_digest},policyVersion:1,invariantVersions:c.invariants,
  limits:{requests:t.reserved_requests,concurrency:t.reserved_concurrency,durationSeconds:a.duration_seconds,responseBytes:1048576,artifactBytes:4194304,spendMicros:0,requestsPerSecond:2,burst:5},
  paymentMode:"TEST_ONLY",dataPolicy:"REDACTED_ONLY"});
}
export class Orchestrator {
 readonly workerId=randomUUID();
 constructor(private readonly store:ExecutionStore,private readonly provider:RunnerProvider,private readonly key:KeyObject,private readonly artifacts:ArtifactStore){}
 async tick() {
  await this.store.command("RECOVER",{});
  const cleanup=await this.store.command("CLEANUP_CLAIM",{workerId:this.workerId});
  if(cleanup){
   const c=z.object({attempt:z.object({id:uuid,fence:z.number(),state:z.string()})}).parse(cleanup);
   await this.provider.terminate(c.attempt.id);await this.provider.cleanup(c.attempt.id);
   if(c.attempt.state!=="COMPLETED")await this.artifacts.removeAttempt(c.attempt.id);
   await this.store.command("CLEANUP_DONE",{attemptId:c.attempt.id,fence:c.attempt.fence,workerId:this.workerId});
  }
  const claim=await this.store.command("CLAIM",{workerId:this.workerId});
  if(claim){const g=grantFromClaim(claim);await this.provider.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:signGrant(g,this.key),deadline:new Date(g.exp*1000).toISOString()});}
 }
 async run(signal:AbortSignal) {
  while(!signal.aborted){
   try{await this.tick();}catch{/* durable lease recovery; host metrics may record a fixed error code, never payloads */}
   await new Promise<void>(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);signal.removeEventListener("abort",done);resolve();}signal.addEventListener("abort",done,{once:true});});
  }
 }
}
