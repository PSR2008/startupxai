import { generateKeyPairSync,randomUUID } from "node:crypto";
import { executionGrantSchema } from "@launchgate/contracts";
import { grantFixture } from "./execution";
import { compilePlan,defaultCapabilities,labInvariant,planHash,type CaseId,type Variant,type TestPlan } from "../../reference-lab/plans";
import { labSourceIdentity,LocalLabProvider } from "../../reference-lab/host";
import { signGrant } from "../../services/runner/grant";
import type { LabFault } from "../../reference-lab/runtime";
export const makePlan=(caseId:CaseId)=>compilePlan(labInvariant(caseId,randomUUID()),caseId,"seed-42",defaultCapabilities(caseId));
export function labGrant(plan:TestPlan,variant:Variant){
 const base=grantFixture(),source=labSourceIdentity();
 return executionGrantSchema.parse({...base,snapshotId:null,commitSha:source.revision,deploymentUrl:"https://reference-lab.invalid/",referenceLab:{planHash:planHash(plan),caseId:plan.caseId,seed:plan.seed,variant,sourceDigest:source.sourceDigest},
  authorization:{...base.authorization,method:"REFERENCE_LAB_HARNESS",targetHost:"reference-lab.invalid",allowedHosts:["reference-lab.invalid"],allowedOperations:["resource.read","resource.write","role.change","session.check"],requestLimit:32},
  invariantVersions:[{id:plan.spec.id,version:plan.spec.version}],limits:{...base.limits,requests:32,artifactBytes:65536}});
}
export async function executeCase(caseId:CaseId,variant:Variant,options:{fault?:LabFault;reproductionVariant?:Variant;reproductionFault?:LabFault;plan?:TestPlan}={}){
 const plan=options.plan??makePlan(caseId),g=labGrant(plan,variant),keys=generateKeyPairSync("ed25519");let requests=0,started=false;
 const store={async command(action:string,data:Record<string,unknown>):Promise<unknown>{
  if(action==="LAB_CONTEXT")return {case:{plan,plan_hash:planHash(plan)},template:{variant,source_digest:g.referenceLab!.sourceDigest}};
  if(data.attemptId!==g.attemptId||data.fence!==g.fence||data.grantId!==g.jti)throw new Error("SCOPE");
  if(action==="START"){if(started)throw new Error("REPLAY");started=true;}
  if(action==="REQUEST"){if(!started||++requests>32)throw new Error("BUDGET");}
  if(action==="LAB_COMPLETE"&&data.requests!==requests)throw new Error("ACCOUNTING");return {};
 }};
 const provider=new LocalLabProvider(keys.publicKey,store,{async put(a,id){return `${a}/${id}`;},async removeAttempt(){}},{...options,pace:async()=>{}});
 await provider.launch({attemptId:g.attemptId,runnerId:g.runner.identity,grant:signGrant(g,keys.privateKey),deadline:new Date(g.exp*1000).toISOString()});
 try{await provider.drain();return {result:provider.results.get(g.runId)!,requests,plan,grant:g};}finally{await provider.terminate(g.attemptId);await provider.cleanup(g.attemptId);}
}
