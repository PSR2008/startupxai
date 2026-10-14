import { candidate, fixtureEvidence, spec, hash } from "./launchgate";
import { evidenceDigest } from "@launchgate/verification-core";
import { invariantSetDigest, type ReleaseEvidence } from "../../services/releases/engine";
import type { Release, ReleasePolicy } from "../../services/releases/contracts";
export const evaluationTime = "2026-10-11T00:00:10.000Z";
export function releaseFixture(variant: "fixed" | "vulnerable" | "inconclusive" = "fixed") {
  const policy: ReleasePolicy = { id: candidate.policyId, version: 1, blockingSeverities: ["high", "critical"], requiredFamilies: ["tenant_isolation"],
    requirements: [{ invariant: structuredClone(spec), required: true, baseline: true, kind: "INVARIANT", family: "tenant_isolation", runnerVersion: "1", testVersion: "1", fixtureVersion: 1, planHash: hash, estimatedCost: 1, applicabilityProof: null }],
    freshnessSeconds: 60, environments: ["SANDBOX"], minimumCoverage: 1, requiredInconclusive: "NON_APPROVAL", allowExceptions: true, maximumExceptionSeconds: 3600 };
  const release: Release = { id: "release-1", candidate: structuredClone(candidate), repositoryConnectionId: null, snapshotId: null, provider: "REFERENCE_LAB", providerDeploymentId: "lab-provider-1", deploymentCommitSha: candidate.commitSha,
    environmentId: "lab-env", environment: "SANDBOX", invariantSetDigest: invariantSetDigest(policy), requestedBy: "owner", createdAt: "2026-10-11T00:00:00.000Z", baseSha: null, headSha: candidate.commitSha, pullRequest: null, branch: null };
  const e = fixtureEvidence(variant);
  const evidence: ReleaseEvidence = { invariantId: spec.id, evidence: e, admission: { kind: "REFERENCE_LAB" }, manifestDigest: evidenceDigest(e),
    authorization: { id: "authorization-1", expiresAt: "2026-10-11T01:00:00.000Z", revokedAt: null }, testVersion: "1", fixtureVersion: 1, planHash: hash };
  return { release, policy, evidence: [evidence], now: evaluationTime };
}
