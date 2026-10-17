import "server-only";
import { Orchestrator } from "../../../services/orchestrator/orchestrator";
import type { ExecutionStore } from "../../../services/orchestrator/store";
import { ProductionArtifacts } from "../../../services/production/artifacts";
import { productionConfiguration } from "./configuration";
import { productionRunner, ProductionSandboxRunner } from "../../../services/production/runner";
import { CleanupReaper } from "../../../services/production/reaper";
import { resourceCleaner } from "../../../services/production/cleanup";
import { scopedCredentialDelivery } from "../../../services/production/delivery";
import { CredentialBroker, type ManagedSecretStore, type SecretReference } from "../../../services/production/secrets";
import type { PrivateObjectBackend } from "../../../services/production/artifacts";
import { Observer, ProviderCircuit } from "../../../services/production/operations";
import type { RunnerKeyRing } from "../../../services/production/rotation";
import type { Scope, SandboxProvider, OperationsStore } from "../../../services/production/contracts";
import { readiness, type Qualification } from "../../../services/production/readiness";
/** Operator dependency injection only. No cloud adapter is registered by default.
 * General PR CI must never instantiate this with production credentials. */
export async function createProductionRuntime(input: { env: Record<string,string|undefined>; provider: SandboxProvider; secrets: ManagedSecretStore; objects: PrivateObjectBackend;
  scopeForAttempt: (attemptId: string) => Promise<Scope>; operations: OperationsStore; execution: ExecutionStore; keys: RunnerKeyRing; qualifications: () => Promise<Qualification[]>; observer: Observer;
  authorize: (scope: Scope) => Promise<void>; credentials: (scope: Scope) => Promise<SecretReference | null> }) {
  const config=productionConfiguration(input.env);
  if(input.secrets.kind!=="managed"||input.objects.kind!=="managed"||input.objects.private!==true||input.objects.encryption!=="PROVIDER_KMS")throw new Error("MANAGED_BACKENDS_REQUIRED");
  const authorize=async(scope:Scope)=>{if(scope.environment!==config.environment||!readiness(config,await input.qualifications()).productionReady)throw new Error("PRODUCTION_NOT_QUALIFIED");await input.authorize(scope);};
  productionRunner({config,qualifications:await input.qualifications(),provider:input.provider,store:input.operations,grants:input.keys,authorize,observer:input.observer});
  const broker=new CredentialBroker(input.secrets,authorize);
  const runner=new ProductionSandboxRunner(input.provider,input.operations,input.keys,config.environment as "staging"|"production",authorize,input.observer,new ProviderCircuit(),scopedCredentialDelivery(input.provider,broker,input.operations,input.credentials));
  const scopedArtifacts=async(attemptId:string)=>{const scope=await input.scopeForAttempt(attemptId);if(scope.environment!==config.environment||scope.attemptId!==attemptId)throw new Error("ARTIFACT_ENVIRONMENT");return new ProductionArtifacts(input.objects,scope,()=>input.authorize(scope),Date.now,input.operations);};
  const orchestrator=new Orchestrator(input.execution,runner,input.keys,{async put(attemptId,id,bytes,hash){return (await scopedArtifacts(attemptId)).put(attemptId,id,bytes,hash);},async removeAttempt(attemptId){await (await scopedArtifacts(attemptId)).removeAttempt(attemptId);}});
  const reaper=new CleanupReaper(input.operations,input.execution,resourceCleaner(config.environment,input.provider,input.secrets,input.objects),config.environment);
  return {orchestrator,reaper,runner,async run(signal:AbortSignal){
    while(!signal.aborted){
      // Failure propagates to the host; persisted leases permit a supervised restart.
      await reaper.tick(); await orchestrator.tick();
      await new Promise<void>(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);signal.removeEventListener("abort",done);resolve();}signal.addEventListener("abort",done,{once:true});if(signal.aborted)done();});
    }
  }};
}
