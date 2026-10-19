import { generateKeyPairSync } from "node:crypto";
import { z } from "zod";
import { LocalLabProvider, labSourceIdentity } from "../../reference-lab/host";
import { Orchestrator } from "../orchestrator/orchestrator";
import type { ArtifactStore } from "../orchestrator/artifacts";
import { ReleaseWorker } from "../releases/worker";
import { RemediationWorker } from "../remediation/worker";
import { DeterministicRemediationProvider } from "../remediation/provider";
import { registeredLabDriver } from "../remediation/lab-driver";
import { productLabCatalog } from "./catalog";
export type ServiceCommand=(name:"lg_product_lab_service"|"lg_execution_service"|"lg_release_service"|"lg_fix_service",action:string,data:Record<string,unknown>)=>Promise<unknown>;
/** Operator-only local worker. Never imported into browser or request execution. */
export class ProductLabWorker {
 constructor(private readonly command:ServiceCommand,private readonly artifacts:ArtifactStore){}
 async tick(){
  const claimed=await this.command("lg_product_lab_service","CLAIM",{});
  if(!claimed)return false;
  const lab=z.object({project_id:z.string().uuid(),organization_id:z.string().uuid(),created_by:z.string().uuid(),invariant_id:z.string().uuid(),adjacent_id:z.string().uuid(),policy_id:z.string().uuid(),lease_id:z.string().uuid()}).parse(claimed);
  const keys=generateKeyPairSync("ed25519"),execution={command:(a:string,d:Record<string,unknown>)=>this.command("lg_execution_service",a,d)},releaseStore={command:(a:string,d:Record<string,unknown>)=>this.command("lg_release_service",a,d)};
  const {plans}=productLabCatalog(lab),provider=new LocalLabProvider(keys.publicKey,execution,this.artifacts),orchestrator=new Orchestrator(execution,provider,keys.privateKey,this.artifacts);
  const releases=new ReleaseWorker(releaseStore,{lab:{identity:labSourceIdentity,plans:new Map(plans.map((plan,i)=>[plan.spec.id,{plan,variant:i===0?"vulnerable":"fixed"}]))}});
  const lease={projectId:lab.project_id,leaseId:lab.lease_id};
  try{
   const deployment=z.object({deploymentId:z.string().uuid()}).parse(await releaseStore.command("LAB_DEPLOYMENT",{projectId:lab.project_id,actorId:lab.created_by,...labSourceIdentity()}));
   const release=z.object({id:z.string().uuid()}).parse(await releaseStore.command("CREATE",{projectId:lab.project_id,actorId:lab.created_by,policyId:lab.policy_id,policyVersion:1,deploymentId:deployment.deploymentId}));
   for(let i=0;i<12;i++){
    const result=await releases.tick();
    if(result?.releaseId===release.id){await this.command("lg_product_lab_service","COMPLETE",{...lease,releaseId:release.id});return true;}
    await orchestrator.tick();await provider.drain();
   }
   throw new Error("LAB_EXECUTION_INCOMPLETE");
  }catch(error){await this.command("lg_product_lab_service","FAIL",lease);throw error;}
  finally{await provider.drain().catch(()=>{});for(const result of provider.results.values()){await provider.terminate(result.bundle.attemptId);await provider.cleanup(result.bundle.attemptId);}}
 }
 async remediationTick(){
  const keys=generateKeyPairSync("ed25519"),execution={command:(a:string,d:Record<string,unknown>)=>this.command("lg_execution_service",a,d)},releases={command:(a:string,d:Record<string,unknown>)=>this.command("lg_release_service",a,d)};
  // Adjacent plans are loaded from durable lab identities by the operator store.
  const labs=z.array(z.object({invariant_id:z.string().uuid(),adjacent_id:z.string().uuid(),policy_id:z.string().uuid()})).parse(await this.command("lg_product_lab_service","CATALOG",{}));
  const plans=new Map(labs.flatMap(lab=>productLabCatalog(lab).plans.map(plan=>[plan.spec.id,plan] as const)));
  const driver=registeredLabDriver({execution,releases,artifacts:this.artifacts,...keys,plans});
  const worker=new RemediationWorker({command:(a,d)=>this.command("lg_fix_service",a,d)},new DeterministicRemediationProvider(),driver);
  return worker.tick();
 }
}
