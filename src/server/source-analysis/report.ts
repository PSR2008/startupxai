import "server-only";
import { z } from "zod";
import { safePath } from "@launchgate/source-analysis";

const provenance=z.object({path:z.string().max(240).refine(p=>safePath(p)),digest:z.string().regex(/^[a-f0-9]{64}$/),blobSha:z.string().regex(/^[a-f0-9]{40}$/),startLine:z.number().int().min(1).max(65537),endLine:z.number().int().min(1).max(65537)}).strict();
const nodeKind=z.enum(["EXTERNAL_INTEGRATION","MIGRATION","DATABASE_TABLE","RLS_ENABLEMENT","RLS_POLICY","SECURITY_DEFINER","GRANT","REVOKE","TENANT_COLUMN","ROUTE_HANDLER","PAGE","MIDDLEWARE","DATABASE_CLIENT","AUTH_BOUNDARY","ROLE_CHECK","TENANT_CHECK","ENTITLEMENT_CHECK","QUOTA_CHECK","PAYMENT_ENDPOINT","WEBHOOK_ENDPOINT","AI_PROVIDER_CALL","SERVICE_ROLE_USE","CREDENTIAL_ENV_USE"]);
const id=z.string().regex(/^[a-f0-9]{32}$/);
const proposal=z.object({id,domain:z.enum(["tenant_isolation","authorization","billing","webhooks","paid_features","ai_cost","authentication"]),statement:z.string().min(1).max(2000),rationale:z.string().max(500),evidence:z.array(provenance).min(1).max(20),assumptions:z.array(z.string().max(500)).min(1).max(10),confidence:z.enum(["LOW","MEDIUM"]),confirmationRequired:z.literal(true),status:z.literal("PROPOSED")}).strict();
export const reportSchema=z.object({analysisVersion:z.literal("lg-static-1"),kind:z.literal("STATIC_OBSERVATIONS"),
 coverage:z.object({status:z.enum(["COMPLETE","PARTIAL"]),exclusions:z.array(z.object({path:z.string().max(240).optional(),pathHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),reason:z.string().max(50)}).strict()).max(2000),diagnostics:z.array(z.object({path:z.string().max(240),code:z.string().max(50)}).strict()).max(1000)}).strict(),
 stacks:z.array(z.object({name:z.enum(["Next.js","React","Supabase","PostgreSQL","Stripe","Razorpay","Vercel","OpenAI","Anthropic"]),status:z.enum(["DETECTED","NOT_DETECTED","AMBIGUOUS"]),evidence:z.array(z.object({stack:z.string().max(30),reason:z.string().max(50),provenance}).strict()).max(2000)}).strict()).length(9),
 nodes:z.array(z.object({id,kind:nodeKind,detail:z.string().max(80),provenance}).strict()).max(4000),
 edges:z.array(z.object({from:id,to:id,kind:z.literal("CONTAINS_OBSERVATION"),provenance}).strict()).max(4000),proposals:z.array(proposal).max(7)
}).strict();
export function validateReport(value:unknown,files:{path:string;digest:string;blobSha:string}[]) {
 const report=reportSchema.parse(value); const references=[...report.nodes.map(n=>n.provenance),...report.edges.map(e=>e.provenance),...report.proposals.flatMap(p=>p.evidence),...report.stacks.flatMap(s=>s.evidence.map(e=>e.provenance))];
 for(const ref of references)if(ref.endLine<ref.startLine||!files.some(f=>f.path===ref.path&&f.digest===ref.digest&&f.blobSha===ref.blobSha))throw new Error("PROVENANCE_MISMATCH");
 const ids=new Set(report.nodes.map(n=>n.id));if(ids.size!==report.nodes.length||report.edges.some(e=>!ids.has(e.from)||!ids.has(e.to)))throw new Error("GRAPH_MISMATCH");
 return report;
}
