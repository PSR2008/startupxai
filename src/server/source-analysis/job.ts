import "server-only";
import { z } from "zod";
import { canonicalJson,hash } from "@launchgate/source-analysis";
import { runAnalysis } from "@launchgate/source-analysis/runner";
import { GitHubProvider } from "../github/provider";
import { githubConfiguration } from "../github/config";
import { sourceStore,type SourceStore } from "../github/store";
import { validateReport } from "./report";

const claimSchema=z.object({snapshot:z.object({id:z.string().uuid(),commit_sha:z.string().regex(/^[a-f0-9]{40}$/),lease:z.string().uuid()}),connection:z.object({application_root:z.string()}),repository:z.object({repository_id:z.number().int().positive()}),installation:z.object({installation_id:z.number().int().positive()})});
/** A separately hosted trusted scheduler calls this, never a browser request or
 * customer script. Durable claim/lease/fencing exists; scheduling is Phase 4. */
export async function processSnapshot(snapshotId:string,dependencies?:{store:SourceStore;provider:Pick<GitHubProvider,"ingestCommit">}) {
 z.string().uuid().parse(snapshotId);
 const store=dependencies?.store??sourceStore();
 const value=await store.command("CLAIM",{snapshotId});if(!value)return {state:"NOT_CLAIMED" as const};
 const claim=claimSchema.parse(value);
 try {
  const provider=dependencies?.provider??new GitHubProvider(githubConfiguration());
  const data=await provider.ingestCommit(claim.installation.installation_id,claim.repository.repository_id,claim.snapshot.commit_sha,claim.connection.application_root,async()=>{await store.command("CHECK",{snapshotId,lease:claim.snapshot.lease});});
  const report=validateReport(await runAnalysis(data.source),data.source.files);
  const files=data.source.files.map(({path,digest,blobSha,bytes,classification})=>({path,digest,blobSha,bytes,classification}));
  await store.command("COMPLETE",{snapshotId,lease:claim.snapshot.lease,commitSha:data.commitSha,treeSha:data.treeSha,files,report,reportDigest:hash(canonicalJson(report)),sourceState:data.source.status});
  return {state:"COMPLETE" as const};
 }catch{
  try{await store.command("FAIL",{snapshotId,lease:claim.snapshot.lease,code:"ANALYSIS_FAILED"});}catch{/* Revocation/stale lease fails closed; do not leak diagnostics. */}
  return {state:"FAILED" as const};
 }
}
