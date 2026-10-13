import { z } from "zod";
import { invariantSchema,type Invariant } from "@launchgate/invariant-spec";
import { canonical,digest } from "../services/runner/metadata";

export const cases=["auth.api","auth.route","auth.action","auth.invalid","auth.expired","auth.logout","tenant.read","tenant.write","tenant.delete","role.member_owner","role.member_admin","role.viewer_developer","role.developer_owner"] as const;
export const caseSchema=z.enum(cases);
export type CaseId=z.infer<typeof caseSchema>;
export const identities=["anonymous","tenant_a_owner","tenant_a_member","tenant_a_viewer","tenant_a_developer","tenant_b_owner","tenant_b_member"] as const;
export type Identity=typeof identities[number];
export const variantSchema=z.enum(["vulnerable","fixed","inconclusive"]);
export type Variant=z.infer<typeof variantSchema>;
export function recipe(caseId:CaseId){
 const family=caseId.startsWith("auth.")?"auth_session_boundaries":caseId.startsWith("tenant.")?"tenant_isolation":"privilege_escalation";
 const actor:Identity=caseId==="auth.logout"||caseId==="auth.expired"?"tenant_b_owner":caseId.startsWith("auth.")?"anonymous":caseId==="role.viewer_developer"?"tenant_a_viewer":caseId==="role.developer_owner"?"tenant_a_developer":"tenant_a_member";
 const kind=caseId.startsWith("auth.")?"session.check":caseId==="tenant.read"?"resource.read":caseId.startsWith("tenant.")?"resource.write":"role.change";
 return {family,actor,kind,resource:caseId.startsWith("role.")?actor:"resource_b",resourceType:caseId.startsWith("role.")?"membership":"project"} as const;
}
export function labInvariant(caseId:CaseId,id:string=caseId):Invariant {
 const r=recipe(caseId);
 return invariantSchema.parse({schemaVersion:1,id,version:1,domain:r.family==="auth_session_boundaries"?"authentication":r.family==="tenant_isolation"?"tenant_isolation":"authorization",
  statement:`Registered Reference Lab boundary: ${caseId}`,applicability:{status:"APPLICABLE"},actors:[{name:r.actor,fixtureRef:r.actor}],resources:[{name:r.resource,fixtureRef:r.resource}],
  preconditions:["health","positive_control","observable","cleanup"],operation:{kind:r.kind,actor:r.actor,resource:r.resource,maxAttempts:2},
  assertions:[{id:"not_visible",observation:"target_visible",comparator:"equals",expected:false},{id:"no_side_effect",observation:"state_unchanged",comparator:"equals",expected:true}],
  severity:"high",provenance:{source:"reference_lab",references:[`reference-lab-v1:${caseId}`]},confirmation:{status:"CONFIRMED",confirmedBy:"reference-lab-operator",confirmedAt:"2026-10-12T00:00:00.000Z"}});
}
export const capabilitiesSchema=z.object({family:z.enum(["auth_session_boundaries","tenant_isolation","privilege_escalation"]),version:z.literal(1),operations:z.array(caseSchema),observability:z.literal("TRUSTED_FIXTURE_STATE")}).strict();
export const planSchema=z.object({version:z.literal(1),caseId:caseSchema,spec:invariantSchema,seed:z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
 family:capabilitiesSchema.shape.family,fixtureVersion:z.literal(1),logicalActor:z.enum(identities),logicalResource:z.string(),resourceType:z.enum(["membership","project"]),
 positiveControl:z.literal("AUTHORIZED_EQUIVALENT_OPERATION"),observability:z.literal("TRUSTED_FIXTURE_STATE"),cleanup:z.literal("DISPOSE_EVERY_ATTEMPT"),
 budget:z.object({requests:z.literal(32),durationMs:z.literal(60000),artifactBytes:z.literal(65536),concurrency:z.literal(1)}).strict()}).strict();
export type TestPlan=z.infer<typeof planSchema>;
function freeze<T>(value:T):T {if(value&&typeof value==="object"){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
export function compilePlan(input:unknown,caseInput:unknown,seed:string,capabilities:unknown):TestPlan {
 const spec=invariantSchema.parse(input),caseId=caseSchema.parse(caseInput),cap=capabilitiesSchema.parse(capabilities),r=recipe(caseId);
 const approved=labInvariant(caseId,spec.id);
 if(spec.confirmation.status!=="CONFIRMED"||spec.provenance.source!=="reference_lab"||spec.applicability.status!=="APPLICABLE"||cap.family!==r.family||!cap.operations.includes(caseId))throw new Error("UNSUPPORTED_PLAN");
 for(const field of ["actors","resources","operation","preconditions","assertions","domain"] as const)if(canonical(spec[field])!==canonical(approved[field]))throw new Error("UNAPPROVED_ORACLE_OR_BINDING");
 return freeze(planSchema.parse({version:1,caseId,spec,seed,family:r.family,fixtureVersion:1,logicalActor:r.actor,logicalResource:r.resource,resourceType:r.resourceType,
  positiveControl:"AUTHORIZED_EQUIVALENT_OPERATION",observability:cap.observability,cleanup:"DISPOSE_EVERY_ATTEMPT",budget:{requests:32,durationMs:60000,artifactBytes:65536,concurrency:1}}));
}
export const planHash=(plan:TestPlan)=>digest(canonical(planSchema.parse(plan)));
export const defaultCapabilities=(caseId:CaseId)=>({family:recipe(caseId).family,version:1,operations:[caseId],observability:"TRUSTED_FIXTURE_STATE"});
export function validatePlan(value:unknown){const p=planSchema.parse(value);const compiled=compilePlan(p.spec,p.caseId,p.seed,defaultCapabilities(p.caseId));if(canonical(compiled)!==canonical(p))throw new Error("PLAN_CHANGED");return compiled;}
