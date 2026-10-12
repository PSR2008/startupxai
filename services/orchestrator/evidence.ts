import { runnerSubmissionSchema,type ExecutionGrant } from "@launchgate/contracts";
import { canonical,digest,type ArtifactStore } from "./artifacts";
import type { ExecutionStore } from "./store";

export function authority(g:ExecutionGrant){return {attemptId:g.attemptId,fence:g.fence,grantId:g.jti,runnerId:g.runner.identity};}
export async function admitEvidence(g:ExecutionGrant,input:unknown,store:ExecutionStore,artifacts:ArtifactStore,now=Date.now()) {
 const s=runnerSubmissionSchema.parse(input);
 if(Buffer.byteLength(JSON.stringify(input))>6*1048576||s.grantId!==g.jti||s.attemptId!==g.attemptId||s.fence!==g.fence||s.authorizationId!==g.authorizationId||
  s.authorizationVersion!==g.authorizationVersion||s.requestCount>g.limits.requests||Date.parse(s.completedAt)<g.iat*1000||Date.parse(s.completedAt)>now+5000||now>=g.exp*1000)throw new Error("EVIDENCE_SCOPE");
 // Phase 4 has no executable invariant registry. Accepting arbitrary Phase 1
 // assertion reports here would falsely establish trusted security evidence.
 if(s.evidence.length)throw new Error("INVARIANT_EXECUTOR_UNAVAILABLE");
 const ids=new Set<string>();let total=0;
 const validated=s.artifacts.map(a=>{
  if(ids.has(a.id))throw new Error("DUPLICATE_ARTIFACT");ids.add(a.id);
  const bytes=Buffer.from(a.bytes,"base64");total+=bytes.length;
  if(bytes.toString("base64")!==a.bytes||digest(bytes)!==a.hash||total>g.limits.artifactBytes)throw new Error("ARTIFACT_LIMIT_OR_HASH");
  // Only canonical transport metadata accepted; no arbitrary text, URLs, body,
  // screenshots or claimed-redacted secrets can enter this foundation.
  if(bytes.toString("utf8")!==canonical({observations:s.observations}))throw new Error("ARTIFACT_REDACTION");
  return {...a,bytes};
 });
 await store.command("CHECK",authority(g));
 const stored=[];
 for(const a of validated)stored.push({id:a.id,hash:a.hash,size:a.bytes.length,reference:await artifacts.put(g.attemptId,a.id,a.bytes,a.hash)});
 const manifest={schemaVersion:1,runId:g.runId,jobId:g.jobId,attemptId:g.attemptId,fence:g.fence,organizationId:g.organizationId,projectId:g.projectId,
  commitSha:g.commitSha,snapshotId:g.snapshotId,deploymentId:g.deploymentId,deploymentUrl:g.deploymentUrl,authorizationId:g.authorizationId,authorizationVersion:g.authorizationVersion,
  runnerId:g.runner.identity,runnerVersion:g.runner.version,imageDigest:g.runner.imageDigest,invariantVersions:g.invariantVersions,policyVersion:g.policyVersion,
  observationHash:digest(canonical(s.observations)),artifacts:stored,createdAt:s.completedAt,sequence:s.sequence,kind:"INFRASTRUCTURE_OBSERVATION"};
 const hash=digest(canonical(manifest));
 await store.command("COMPLETE",{...authority(g),requests:s.requestCount,manifest,digest:hash,artifacts:stored,observations:s.observations});
 return {manifestDigest:hash,kind:"INFRASTRUCTURE_OBSERVATION" as const};
}
