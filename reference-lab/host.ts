import { createHash,randomUUID,type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { ExecutionStore } from "../services/orchestrator/store";
import type { ArtifactStore } from "../services/orchestrator/artifacts";
import type { RunnerProvider } from "../services/orchestrator/orchestrator";
import { verifyGrant } from "../services/runner/grant";
import { authority } from "../services/orchestrator/evidence";
import { canonical,digest } from "../services/runner/metadata";
import { planHash,validatePlan,type TestPlan,type Variant } from "./plans";
import { startFixture,type LabFault } from "./runtime";
import { collectTrace,type RawTrace } from "./runner";
import { evaluateLab,evaluateTrace,positiveControl } from "./evaluation";
import { startBillingFixture } from "./billing/fixture";
import { collectBilling } from "./billing/collector";
import type { BillingFault } from "./billing/contracts";
import { startAiFixture } from "./ai/fixture";
import { collectAi } from "./ai/collector";
import type { AiFault } from "./ai/contracts";
import { startBrowserFixture } from "./browser/fixture";
import { collectBrowser } from "./browser/collector";
import type { BrowserFault } from "./browser/contracts";

export function labSourceIdentity(){
 const files=["plans.ts","runtime.ts","runner.ts","evaluation.ts","host.ts","billing/contracts.ts","billing/provider.ts","billing/fixture.ts","billing/collector.ts","billing/oracle.ts","ai/contracts.ts","ai/binding.ts","ai/provider.ts","ai/fixture.ts","ai/collector.ts","ai/oracle.ts","browser/contracts.ts","browser/fixture.ts","browser/collector.ts","browser/oracle.ts"].map(name=>readFileSync(new URL(name,import.meta.url),"utf8"));
 const source=canonical(files);return {sourceDigest:digest(source),revision:createHash("sha1").update(source).digest("hex")};
}
export interface RegisteredLabPreview {
 identity(): { revision: string; sourceDigest: string };
 startFixture?: typeof startFixture;
 startBillingFixture?: typeof startBillingFixture;
 startAiFixture?: typeof startAiFixture;
}
export async function registerLabRun(store:ExecutionStore,projectId:string,actorId:string,planInput:TestPlan,variant:Variant,requestKey=randomUUID()){
 const plan=validatePlan(planInput);return store.command("LAB_CREATE",{projectId,actorId,plan,planHash:planHash(plan),variant,requestKey,...labSourceIdentity()});
}
/** Internal admission. Never mount this on a browser-session-authorized route. */
export async function admitLab(token:string,key:KeyObject,tracesInput:unknown[],store:ExecutionStore,artifacts:ArtifactStore,preview?:RegisteredLabPreview){
 const g=verifyGrant(token,key);if(!g.referenceLab)throw new Error("LAB_GRANT_REQUIRED");
 await store.command("CHECK",authority(g));
 const context=z.object({case:z.object({plan:z.unknown(),plan_hash:z.string()}),template:z.object({source_digest:z.string(),variant:z.string()}),releasePolicy:z.object({releaseId:z.string().uuid(),policyId:z.string().uuid(),policyVersion:z.number().int().positive()}).optional()}).parse(await store.command("LAB_CONTEXT",{runId:g.runId}));
 if(canonical(context.releasePolicy??null)!==canonical(g.releasePolicy??null))throw new Error("RELEASE_POLICY_BINDING");
 const plan=validatePlan(context.case.plan);const actual=preview?.identity()??labSourceIdentity();
 if(plan.caseId!==g.referenceLab.caseId||plan.seed!==g.referenceLab.seed||!g.authorization.allowedOperations.includes(plan.spec.operation.kind))throw new Error("LAB_SCOPE");
 if(planHash(plan)!==g.referenceLab.planHash||context.case.plan_hash!==g.referenceLab.planHash||actual.sourceDigest!==g.referenceLab.sourceDigest||actual.revision!==g.commitSha||context.template.variant!==g.referenceLab.variant||context.template.source_digest!==actual.sourceDigest||g.invariantVersions.length!==1||g.invariantVersions[0].id!==plan.spec.id||g.invariantVersions[0].version!==plan.spec.version)throw new Error("LAB_PROVENANCE");
 const evaluated=evaluateLab(plan,g,tracesInput,actual.sourceDigest);
 const bytes=Buffer.from(canonical(evaluated.traces));if(bytes.length>Math.min(plan.budget.artifactBytes,g.limits.artifactBytes))throw new Error("ARTIFACT_LIMIT");
 const art=evaluated.evidence.artifacts[0];const reference=await artifacts.put(g.attemptId,art.id,bytes,art.hash);
 const artifact={id:art.id,hash:art.hash,size:bytes.length,reference};
 const bundle={...evaluated.bundle,evidence:evaluated.evidence,artifact};const manifestDigest=digest(canonical(bundle));
 const result=await store.command("LAB_COMPLETE",{...authority(g),planHash:planHash(plan),outcome:evaluated.evaluation.outcome,requests:evaluated.requests,candidate:evaluated.candidate,signature:evaluated.signature,
  traces:evaluated.traces,assertions:evaluated.evidence.original.assertions,bundle,manifestDigest,artifact});
 return {...evaluated,bundle,manifestDigest,result};
}
export class LocalLabProvider implements RunnerProvider {
 private tasks=new Map<string,{abort:AbortController;promise:Promise<void>}>();
 readonly results=new Map<string,Awaited<ReturnType<typeof admitLab>>>();
 constructor(private readonly key:KeyObject,private readonly store:ExecutionStore,private readonly artifacts:ArtifactStore,
  private readonly options:{preview?:RegisteredLabPreview;pace?:()=>Promise<void>;fault?:LabFault;billingFault?:BillingFault;aiFault?:AiFault;browserFault?:BrowserFault;reproductionVariant?:Variant;reproductionFault?:LabFault}={}){}
 async launch(input:{attemptId:string;runnerId:string;grant:string;deadline:string}) {
  const g=verifyGrant(input.grant,this.key);
  if(!g.referenceLab||g.attemptId!==input.attemptId||g.runner.identity!==input.runnerId||g.deploymentUrl!=="https://reference-lab.invalid/")throw new Error("CONTROLLED_LAB_ONLY");
  if(this.tasks.has(input.attemptId))return;
  const abort=new AbortController();const promise=this.execute(input.grant,abort.signal);this.tasks.set(input.attemptId,{abort,promise});
  // Retain rejection for drain/cleanup; avoid detached unhandled promises.
  void promise.catch(()=>{});
 }
 private async execute(token:string,signal:AbortSignal){
  const g=verifyGrant(token,this.key);const lab=g.referenceLab!;
  const context=z.object({case:z.object({plan:z.unknown()})}).parse(await this.store.command("LAB_CONTEXT",{runId:g.runId}));const plan=validatePlan(context.case.plan);
  if(planHash(plan)!==lab.planHash||plan.caseId!==lab.caseId||plan.seed!==lab.seed||!g.authorization.allowedOperations.includes(plan.spec.operation.kind)||lab.sourceDigest!==(this.options.preview?.identity()??labSourceIdentity()).sourceDigest)throw new Error("PLAN_CHANGED");
  await this.store.command("START",authority(g));
  const stop=new AbortController();const bounded=AbortSignal.any([signal,stop.signal,AbortSignal.timeout(Math.max(1,g.exp*1000-Date.now()))]);
  let checking=false;const timer=setInterval(()=>{if(!checking){checking=true;this.store.command("CHECK",authority(g)).catch(()=>stop.abort()).finally(()=>{checking=false;});}},1000);
  try {
   let consumed=0;const consume=async()=>{if(++consumed>Math.min(plan.budget.requests,g.limits.requests))throw new Error("SHARED_REQUEST_BUDGET");await this.store.command("REQUEST",authority(g));};
   const collect=async(variant:Variant,fault?:LabFault)=>{
    bounded.throwIfAborted();await this.store.command("CHECK",authority(g));
    if(plan.ai){const runtime=await (this.options.preview?.startAiFixture??startAiFixture)(plan,variant,this.options.aiFault);return collectAi(plan,g,runtime,bounded,consume,async t=>positiveControl(plan,t),this.options.pace);}
    if(plan.journey){const runtime=await startBrowserFixture(plan,variant,this.options.browserFault);return collectBrowser(plan,g,runtime,bounded,consume,async t=>positiveControl(plan,t),this.options.pace);}
    if(plan.billing){const runtime=await (this.options.preview?.startBillingFixture??startBillingFixture)(plan,variant,this.options.billingFault);return collectBilling(plan,g,runtime,bounded,consume,async t=>positiveControl(plan,t),this.options.pace);}
    const runtime=await (this.options.preview?.startFixture??startFixture)(plan.caseId,variant,plan.seed,fault);
    return collectTrace(plan,g,runtime,bounded,consume,async t=>positiveControl(plan,t),this.options.pace);
   };
   const traces:RawTrace[]=[await collect(lab.variant,this.options.fault)];
   if(evaluateTrace(plan,traces[0]).candidate&&!bounded.aborted)traces.push(await collect(this.options.reproductionVariant??lab.variant,this.options.reproductionFault??this.options.fault));
   bounded.throwIfAborted();
   this.results.set(g.runId,await admitLab(token,this.key,traces,this.store,this.artifacts,this.options.preview));
  }catch(error){await this.store.command("FAIL",authority(g)).catch(()=>{});throw error;}
  finally{clearInterval(timer);}
 }
 async drain(){await Promise.all([...this.tasks.values()].map(t=>t.promise));}
 async terminate(attemptId:string){this.tasks.get(attemptId)?.abort.abort();}
 async cleanup(attemptId:string){const task=this.tasks.get(attemptId);if(task)await task.promise.catch(()=>{});this.tasks.delete(attemptId);}
}
