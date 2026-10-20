import { z } from "zod";
import type { ExecutionGrant } from "@launchgate/contracts";
export const environmentSchema = z.enum(["development", "test", "staging", "production"]);
export const scopeSchema = z.object({ environment: environmentSchema, organizationId: z.string().uuid(), runId: z.string().uuid(), attemptId: z.string().uuid() }).strict();
export type Scope = z.infer<typeof scopeSchema>;
export const scopeKey = (scope: Scope) => { const s = scopeSchema.parse(scope); return `${s.environment}/${s.organizationId}/${s.runId}/${s.attemptId}`; };
export const capabilityNames = ["github.live", "vercel.live", "supabase.hosted", "stripe.test", "razorpay.test", "openai.live", "anthropic.live", "sandbox.production", "secrets.managed", "artifacts.private", "staging.e2e", "github.checks.live", "github.remediation.live", "artifact_store.managed", "secret_store.managed", "staging.full_e2e", "staging.deployment", "staging.recovery", "staging.cleanup", "cli.windows.staging", "github.action.live", "assessment.external", "sharing.external"] as const;
export const capabilitySchema = z.enum(capabilityNames);
export const statusSchema = z.enum(["VERIFIED", "UNVERIFIED", "BLOCKED_BY_ENVIRONMENT", "DEGRADED", "NOT_IMPLEMENTED"]);
export type CapabilityStatus = z.infer<typeof statusSchema>;
export interface EgressPolicy { defaultAction: "DENY"; host: string; port: 443; protocol: "https"; dns: "VALIDATE_ALL_AND_PIN_EACH_CONNECTION"; redirects: "DENY"; subresources: "SAME_POLICY"; metadata: "DENY"; providerEndpoints: readonly [] }
export const isolationPolicy = Object.freeze({ hostSocket: false, hostNamespaces: false, devices: false, privileged: false, ambientIdentity: false, publicInbound: false, sharedWritableMounts: false,
  source: "READ_ONLY", scratch: "/scratch", symlinks: "DENY", uid: 65532, processes: 32, fileDescriptors: 128, diskBytes: 268435456, memoryBytes: 536870912, cpu: 1, maxSeconds: 900, customerCommands: false } as const);
export interface SandboxSpec { scope: Scope; idempotencyKey: string; imageDigest: string; deadline: string; isolation: typeof isolationPolicy }
export interface Attestation { provider: string; sandboxId: string; scope: Scope; imageDigest: string; policyDigest: string; isolation: "HARDWARE" | "HARDENED_JOB"; issuedAt: string; expiresAt: string; proofReference: string }
/** Infrastructure must enforce these contracts. A mock response is not attestation of OS isolation. */
export interface SandboxProvider {
  readonly kind: "production" | "local-test";
  readonly name: string;
  createSandbox(spec: SandboxSpec): Promise<{ id: string }>;
  injectScopedCredential(id: string, name: "execution-grant" | "target-session" | "preview-bypass" | "test-provider", material: Uint8Array, expiresAt: string): Promise<void>;
  configureEgressPolicy(id: string, policy: EgressPolicy): Promise<void>;
  startExecution(id: string, operation: "launchgate-controlled-verification", key: string): Promise<void>;
  heartbeat(id: string): Promise<{ alive: boolean }>;
  streamEvents(id: string, signal: AbortSignal): AsyncIterable<{ sequence: number; type: "STARTED" | "STOPPED" | "FAILED"; code: string }>;
  terminate(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  getUsage(id: string): Promise<{ cpuMillis: number; memoryBytes: number; diskBytes: number }>;
  getAttestationMetadata(id: string): Promise<Attestation>;
}
export interface OperationsStore { command(action: string, data: Record<string, unknown>): Promise<unknown> }
export interface GrantAuthority { verify(token: string): ExecutionGrant }
export interface ResourceRecord { id: string; scope: Scope; kind: "SANDBOX" | "CREDENTIAL" | "ARTIFACT"; provider: string; externalId: string; expiresAt: string; fence: number }
