import "server-only";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { isAbsolute, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { configuredValue } from "../env";
import { remediationStore } from "./store";
import { releaseStore } from "../releases/store";
import { rpcExecutionStore } from "../../../services/orchestrator/store";
import { LocalArtifacts } from "../../../services/orchestrator/artifacts";
import { RemediationWorker } from "../../../services/remediation/worker";
import { registeredLabDriver } from "../../../services/remediation/lab-driver";
import { DeterministicRemediationProvider } from "../../../services/remediation/provider";
import { caseSchema, compilePlan, defaultCapabilities, planHash, type TestPlan } from "../../../reference-lab/plans";

/** Separate trusted process, opt-in controlled lab only. Not a customer sandbox. */
export async function runRemediationWorker(signal: AbortSignal) {
  const url=configuredValue("NEXT_PUBLIC_SUPABASE_URL"),key=configuredValue("SUPABASE_SERVICE_ROLE_KEY"),pem=process.env.LAUNCHGATE_RUNNER_PRIVATE_KEY,root=process.env.LAUNCHGATE_PRIVATE_ARTIFACT_ROOT;
  if(process.env.LAUNCHGATE_REMEDIATION_LAB_ENABLED!=="1"||!url||!key||!pem||!root||!isAbsolute(root)||resolve(root)===resolve(process.cwd())||resolve(root).startsWith(resolve(process.cwd())+sep))throw new Error("CONTROLLED_REMEDIATION_CONFIGURATION_REQUIRED");
  const privateKey=createPrivateKey(pem.replaceAll("\\n","\n"));if(privateKey.asymmetricKeyType!=="ed25519")throw new Error("SIGNING_KEY_TYPE");
  const publicKey=createPublicKey(privateKey),client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const execution=rpcExecutionStore(async(name,args)=>client.rpc(name,args)),releases=releaseStore(),artifacts=new LocalArtifacts(root);
  const worker=new RemediationWorker(remediationStore(),new DeterministicRemediationProvider(),async input=>{
    const plans=new Map<string,TestPlan>();
    for(const req of input.policy.requirements){
      const ref=req.invariant.provenance.references.find(r=>r.startsWith("reference-lab-v1:"));if(!ref)continue;
      const parsed=caseSchema.safeParse(ref.slice("reference-lab-v1:".length));if(!parsed.success)continue;
      const plan=compilePlan(req.invariant,parsed.data,input.plan.seed,defaultCapabilities(parsed.data));
      if(planHash(plan)===req.planHash)plans.set(req.invariant.id,plan);
    }
    return registeredLabDriver({execution,releases,artifacts,privateKey,publicKey,plans})(input);
  });
  await worker.run(signal);
}
