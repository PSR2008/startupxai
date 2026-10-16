import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonical, digest } from "../runner/metadata";
import { contextDigest, oneLinePatch, safeContext, validatePatch } from "./patch";
import { proposalSchema, type RemediationContext, type RemediationProvider, type Proposal } from "./contracts";
import { architectureDigest } from "./architecture";

const templates = {
  "tenant.read": { path: "reference-lab/runtime.ts", before: '   if(!permitted&&!vulnerable)return reply(fault==="SANITIZED_200"?200:fault==="MASKED_404"?404:403,{public:true});', after: '   if(!permitted)return reply(fault==="SANITIZED_200"?200:fault==="MASKED_404"?404:403,{public:true});' },
  "role.member_owner": { path: "reference-lab/runtime.ts", before: '   if(!permitted&&!vulnerable)return reply(403,{});', after: '   if(!permitted)return reply(403,{});' },
  "billing.duplicate": { path: "reference-lab/billing/fixture.ts", before: '  const bad=variant==="vulnerable"&&e.account!=="control";', after: '  const bad=false; // Always use the existing transactional dedupe and verified event path.' },
  "ai.quota": { path: "reference-lab/ai/fixture.ts", before: '  const id=r.actor==="control"?"control":"subject",bad=variant==="vulnerable"&&id==="subject",connection=r.instance==="B"?peer:db;', after: '  const id=r.actor==="control"?"control":"subject",bad=false,connection=r.instance==="B"?peer:db;' },
  "auth.api": { path: "reference-lab/runtime.ts", before: '   if(!actor&&!vulnerable)return reply(fault==="SANITIZED_200"?200:401,{public:true});', after: '   if(!actor)return reply(fault==="SANITIZED_200"?200:401,{public:true});' },
} as const;
export type SupportedCase = keyof typeof templates;
export const adjacentCases: Record<SupportedCase, readonly string[]> = {
  "tenant.read": ["tenant.write"], "role.member_owner": ["role.member_admin"],
  "billing.duplicate": ["billing.concurrent"], "ai.quota": ["ai.concurrent"], "auth.api": ["auth.action", "tenant.read", "role.member_owner", "browser.release"],
};
export function templateSource(caseId: string) {
  const template = templates[caseId as SupportedCase];
  if (!template) throw new Error("UNSUPPORTED");
  const content = readFileSync(new URL(`../../${template.path}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  return { template, file: { path: template.path, content, digest: digest(content), mode: "100644" as const } };
}
function registeredDiff(caseId: string) {
  const { template:t,file }=templateSource(caseId);
  let diff=oneLinePatch(t.path,file.content,t.before,t.after);
  if(caseId==="ai.quota"){
    const before='    const statuses=variant==="vulnerable"?await Promise.all(items.map(r=>invoke(r,meet))):await Promise.all(items.map(async r=>{await meet();return invoke(r);}));return reply(200,{statuses});}';
    const after='    const statuses=await Promise.all(items.map(async r=>{await meet();return invoke(r);}));return reply(200,{statuses});}';
    diff+=oneLinePatch(t.path,file.content,before,after).split("\n").slice(2).join("\n");
  }
  return diff;
}
export function remediationEligibility(input: RemediationContext) {
  if (!input.reproduced || !input.files.length) return "INSUFFICIENT_CONTEXT" as const;
  if (input.provenance !== "REGISTERED_REFERENCE_LAB") return "SUPPORTED_PROPOSAL_ONLY" as const;
  if (!(input.caseId in templates)) return "UNSUPPORTED" as const;
  const { file } = templateSource(input.caseId);
  return input.files.length === 1 && canonical(input.files[0]) === canonical(file) ? "SUPPORTED_AUTOMATIC" as const : "INSUFFICIENT_CONTEXT" as const;
}
export class DeterministicRemediationProvider implements RemediationProvider {
  async propose(input: RemediationContext, signal: AbortSignal): Promise<Proposal> {
    signal.throwIfAborted(); const c = safeContext(input);
    if (remediationEligibility(c) !== "SUPPORTED_AUTOMATIC") throw new Error("MANUAL_REQUIRED");
    return proposalSchema.parse({ id: randomUUID(), findingId: c.findingId, invariantId: c.invariantId, invariantVersion: c.invariantVersion,
      sourceSha: c.sourceSha, contextHash: contextDigest(c), planHash: c.planHash, diff: registeredDiff(c.caseId),
      explanation: "Enforce the registered server boundary while preserving the authorized operation. Verification pending.", generatedBy: "DETERMINISTIC_LAB", provider: "registered-template-v1", risk: "BOUNDED" });
  }
}
/** Static acceptance is deliberately stronger than pattern filtering. Only the
 * exact registered transformation is executable in the controlled fixture. */
export function validateAutomaticPatch(c: RemediationContext, p: Proposal, currentSha: string) {
  const patch = validatePatch(c, p, currentSha);
  if (remediationEligibility(c) !== "SUPPORTED_AUTOMATIC") throw new Error("MANUAL_REQUIRED");
  if (p.diff !== registeredDiff(c.caseId)) throw new Error("UNREGISTERED_TRANSFORMATION");
  if (architectureDigest(c.files) !== c.architectureDigest) throw new Error("SOURCE_GRAPH_BINDING");
  architectureDigest(patch.files);
  return patch;
}
/** Adapter accepts structured data, never tools or commands. Repository content
 * is untrusted data; validation outside the provider retains decision authority. */
export async function generateProposal(provider: RemediationProvider, input: unknown, signal?: AbortSignal) {
  const context = safeContext(input), bounded = AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]);
  const timeout = new Promise<never>((_, reject) => bounded.addEventListener("abort", () => reject(new Error("PROVIDER_UNAVAILABLE")), { once: true }));
  bounded.throwIfAborted();
  const result = await Promise.race([provider.propose(context, bounded), timeout]);
  if (Buffer.byteLength(JSON.stringify(result)) > 40000) throw new Error("PROVIDER_OUTPUT_LIMIT");
  const proposal = proposalSchema.parse(result); validatePatch(context, proposal, context.sourceSha); return proposal;
}
