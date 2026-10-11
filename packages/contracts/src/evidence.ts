import { z } from "zod";
import { identifierSchema } from "@launchgate/invariant-spec";
import { scopeSchema } from "./run";

export const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const observationSchema = z.object({
  id: identifierSchema,
  value: z.union([z.boolean(), z.number().finite(), z.string().max(200)]),
}).strict();
export const attemptSchema = z.object({
  id: identifierSchema,
  completedAt: z.string().datetime(),
  execution: z.enum(["COMPLETED", "TIMEOUT", "MISSING_CREDENTIALS", "SETUP_FAILED", "TARGET_UNAVAILABLE", "RUNNER_ERROR", "UNOBSERVABLE"]),
  preconditions: z.array(z.object({ id: identifierSchema, passed: z.boolean() }).strict()).max(30),
  observations: z.array(observationSchema).max(100),
  // Reported assertions are reconciled with deterministic local recomputation.
  assertions: z.array(z.object({ id: identifierSchema, passed: z.boolean() }).strict()).max(50),
  fixtureStateDigest: digestSchema,
  failureSignature: digestSchema.nullable(),
}).strict();
export const evidenceSchema = z.object({
  schemaVersion: z.literal(1),
  runId: identifierSchema,
  scope: scopeSchema,
  source: z.enum(["DETERMINISTIC_EXECUTION", "MODEL_OUTPUT", "USER_CLAIM"]),
  runner: z.object({ identity: identifierSchema, version: identifierSchema, imageDigest: digestSchema.nullable() }).strict(),
  fixture: z.object({ seed: identifierSchema, logicalIdentities: z.array(identifierSchema).min(1).max(50) }).strict(),
  planDigest: digestSchema,
  original: attemptSchema,
  reproduction: z.discriminatedUnion("status", [
    z.object({ status: z.enum(["NOT_ATTEMPTED", "UNAVAILABLE", "NOT_REPRODUCED"]) }).strict(),
    z.object({ status: z.literal("REPRODUCED"), scope: scopeSchema, planDigest: digestSchema, fixtureSeed: identifierSchema, attempt: attemptSchema }).strict(),
  ]),
  artifacts: z.array(z.object({
    id: identifierSchema, hash: digestSchema,
    classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
    redaction: z.enum(["REDACTED", "NO_SENSITIVE_DATA", "PENDING"]),
  }).strict()).min(1).max(100),
  createdAt: z.string().datetime(),
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;
export type Attempt = z.infer<typeof attemptSchema>;

// NOT a signature or attestation. A future trusted ingestion service must supply
// this after authenticating the runner and checking artifact hashes. Never accept
// this marker from HTTP input, a model, a repository, or customer code.
export type EvidenceAdmission =
  | { kind: "UNTRUSTED" }
  | { kind: "REFERENCE_LAB" }
  | { kind: "AUTHENTICATED_RUNNER"; runId: string; manifestDigest: string };
