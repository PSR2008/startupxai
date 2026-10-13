import { z } from "zod";
import { digestSchema, evidenceSchema } from "./evidence";
import { targetAuthorizationSchema } from "./authorization";

export const executionGrantSchema = z.object({
  iss: z.literal("launchgate-orchestrator"), aud: z.literal("launchgate-runner"),
  jti: z.string().uuid(), iat: z.number().int(), exp: z.number().int(),
  jobId: z.string().uuid(), attemptId: z.string().uuid(), fence: z.number().int().positive(),
  runId: z.string().uuid(), organizationId: z.string().uuid(), projectId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable(), commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  referenceLab: z.object({planHash:digestSchema,caseId:z.string().max(60),seed:z.string().max(60),variant:z.enum(["vulnerable","fixed","inconclusive"]),sourceDigest:digestSchema}).strict().optional(),
  deploymentId: z.string().uuid(), deploymentUrl: z.string().url(),
  authorizationId: z.string().uuid(), authorizationVersion: z.number().int().positive(),
  authorization: targetAuthorizationSchema,
  runner: z.object({ identity: z.string().uuid(), version: z.literal("lg-runner-1"), imageDigest: digestSchema.nullable() }).strict(),
  policyVersion: z.literal(1), invariantVersions: z.array(z.object({id:z.string().uuid(),version:z.number().int().positive()}).strict()).max(30),
  limits: z.object({ requests:z.number().int().min(1).max(1000), concurrency:z.number().int().min(1).max(2),
    durationSeconds:z.number().int().min(1).max(900), responseBytes:z.number().int().min(1).max(1048576),
    artifactBytes:z.number().int().min(1).max(4194304), spendMicros:z.literal(0), requestsPerSecond:z.literal(2), burst:z.literal(5) }).strict(),
  paymentMode:z.literal("TEST_ONLY"), dataPolicy:z.literal("REDACTED_ONLY"),
}).strict().superRefine((g,c)=>{
  const a=g.authorization;
  if(g.exp<=g.iat||g.exp-g.iat>900||a.id!==g.authorizationId||a.organizationId!==g.organizationId||a.projectId!==g.projectId||
    a.allowedHosts.length!==1||a.allowedPorts.length!==1||a.allowedPorts[0]!==443||a.allowedOperations.some(x=>!(g.referenceLab?["resource.read","resource.write","role.change","session.check","payment.observe","webhook.deliver_test_event","ai.invoke","quota.concurrent_attempt","journey.execute_registered"]:["resource.read"]).includes(x))||
    (g.referenceLab ? a.method!=="REFERENCE_LAB_HARNESS"||a.targetHost!=="reference-lab.invalid"||g.deploymentUrl!=="https://reference-lab.invalid/" : g.snapshotId===null||a.method==="REFERENCE_LAB_HARNESS")||
    g.limits.requests>a.requestLimit||g.limits.concurrency>a.concurrencyLimit||g.exp*1000>Date.parse(a.expiresAt))
    c.addIssue({code:z.ZodIssueCode.custom,message:"Invalid execution scope"});
});
export type ExecutionGrant=z.infer<typeof executionGrantSchema>;
// Transport envelope authenticates Phase 1 evidence; it does not invent a verdict.
export const runnerSubmissionSchema=z.object({
  sequence:z.literal(1), completedAt:z.string().datetime(),
  grantId:z.string().uuid(), attemptId:z.string().uuid(), fence:z.number().int().positive(),
  authorizationId:z.string().uuid(), authorizationVersion:z.number().int().positive(),
  requestCount:z.number().int().min(0).max(1000), spendMicros:z.literal(0),
  artifacts:z.array(z.object({id:z.string().uuid(),bytes:z.string().max(1398104),hash:digestSchema,
    type:z.literal("PROBE_METADATA"),classification:z.literal("INTERNAL"),redaction:z.literal("NO_SENSITIVE_DATA")}).strict()).max(4),
  evidence:z.array(evidenceSchema).max(30),
  observations:z.array(z.object({kind:z.literal("TRANSPORT_STATUS"),status:z.number().int().min(100).max(599)}).strict()).max(1),
}).strict();
export type RunnerSubmission=z.infer<typeof runnerSubmissionSchema>;
