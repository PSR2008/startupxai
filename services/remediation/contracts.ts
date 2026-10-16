import { z } from "zod";

export const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const eligibility = z.enum(["SUPPORTED_AUTOMATIC", "SUPPORTED_PROPOSAL_ONLY", "MANUAL_REQUIRED", "UNSUPPORTED", "INSUFFICIENT_CONTEXT"]);
export const states = z.enum(["PROPOSAL_REQUESTED", "GENERATING", "PROPOSED", "VALIDATING", "READY_FOR_PR", "PR_CREATED", "WAITING_FOR_PREVIEW", "VERIFYING", "VERIFIED", "VERIFICATION_FAILED", "INCONCLUSIVE", "STALE", "REJECTED", "SUPERSEDED"]);
export const sourcePath = z.string().max(180).regex(/^[a-zA-Z0-9_/-]+\.(ts|tsx|js|jsx)$/).refine(p => !p.startsWith("/") && !p.includes("//") && p.split("/").every(s => s !== "." && s !== ".." && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s)));
export const sourceFile = z.object({ path: sourcePath, content: z.string().max(65536), digest: hash, mode: z.literal("100644") }).strict();
export const contextSchema = z.object({
  organizationId: z.string().uuid(), projectId: z.string().uuid(), findingId: z.string().uuid(),
  invariantId: z.string().uuid(), invariantVersion: z.number().int().positive(), sourceSha: sha,
  deploymentId: z.string().uuid(), connectionId: z.string().uuid().nullable(),
  planHash: hash, originalManifest: hash, reproduced: z.literal(true),
  files: z.array(sourceFile).min(1).max(4), allowedPaths: z.array(sourcePath).min(1).max(4),
  provenance: z.enum(["REGISTERED_REFERENCE_LAB", "CUSTOMER_SNAPSHOT"]),
  caseId: z.string().max(80), architectureDigest: hash,
}).strict();
export type RemediationContext = z.infer<typeof contextSchema>;
export const proposalSchema = z.object({
  id: z.string().uuid(), findingId: z.string().uuid(), invariantId: z.string().uuid(), invariantVersion: z.number().int().positive(),
  sourceSha: sha, contextHash: hash, planHash: hash, diff: z.string().min(1).max(32768),
  explanation: z.string().min(1).max(1000), generatedBy: z.enum(["DETERMINISTIC_LAB", "MODEL_PROPOSAL"]),
  provider: z.string().max(80), risk: z.enum(["BOUNDED", "MANUAL_REQUIRED"]),
}).strict();
export type Proposal = z.infer<typeof proposalSchema>;
export interface RemediationProvider { propose(context: RemediationContext, signal: AbortSignal): Promise<unknown> }
export interface RemediationStore { command(action: string, data: Record<string, unknown>): Promise<unknown> }
