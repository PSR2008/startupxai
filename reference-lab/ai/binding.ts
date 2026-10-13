import { invariantSchema } from "@launchgate/invariant-spec";
import { canonical,digest } from "../../services/runner/metadata";
import { compilePlan,defaultCapabilities,labInvariant } from "../plans";
import { type AiCase,type AiConfig } from "./contracts";
/** Internal control-plane adapter. Caller must load the stored confirmed source
 * invariant under project authorization; never feed untrusted model output. */
export function bindConfirmedAiInvariant(input:unknown,caseId:AiCase,seed:string,config:AiConfig){
 const source=invariantSchema.parse(input);
 if(source.provenance.source!=="source_analysis"||source.confirmation.status!=="CONFIRMED"||source.applicability.status!=="APPLICABLE"||!["ai_cost","usage_concurrency"].includes(source.domain)||!["ai.invoke","quota.concurrent_attempt"].includes(source.operation.kind))throw new Error("CONFIRMED_AI_BINDING_REQUIRED");
 // Source suspicion is not an oracle: an operator explicitly selects a
 // registered fixture case and confirms its separate Reference Lab policy.
 if(config.policy.status!=="CONFIRMED")throw new Error("POLICY_CONFIRMATION_REQUIRED");
 const plan=compilePlan(labInvariant(caseId,source.id),caseId,seed,defaultCapabilities(caseId),config);
 return Object.freeze({sourceInvariant:source,sourceDigest:digest(canonical(source)),sourceVersion:source.version,fixtureBinding:"REFERENCE_LAB_ONLY" as const,plan});
}
