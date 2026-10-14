import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { evidenceDigest } from "@launchgate/verification-core";
import { executeCase, makePlan } from "./fixtures/dynamic-lab";
import { labSourceIdentity } from "../reference-lab/host";
import { planHash } from "../reference-lab/plans";
import { evaluateRelease, invariantSetDigest, type ReleaseEvidence } from "../services/releases/engine";
import type { Release, ReleasePolicy } from "../services/releases/contracts";

test("Reference Lab A-F: eight real verification domains share an exact release identity", { timeout: 240000 }, async () => {
  const plans = ["auth.api", "tenant.read", "role.member_owner", "billing.failed", "billing.duplicate", "ai.quota", "ai.distributed", "browser.release"].map(id => makePlan(id as Parameters<typeof makePlan>[0]));
  const policy: ReleasePolicy = { id: randomUUID(), version: 1, blockingSeverities: ["critical", "high"], requiredFamilies: [...new Set(plans.map(p => p.family))],
    requirements: plans.map(p => ({ invariant: p.spec, required: true, baseline: true, kind: p.caseId === "tenant.read" ? "REGRESSION" : p.journey ? "JOURNEY" : "INVARIANT", family: p.family, runnerVersion: "lg-runner-1", testVersion: "lab-test-1", fixtureVersion: 1, planHash: planHash(p), estimatedCost: p.budget.requests, applicabilityProof: null })),
    freshnessSeconds: 1800, environments: ["SANDBOX"], minimumCoverage: 1, requiredInconclusive: "NON_APPROVAL", allowExceptions: false, maximumExceptionSeconds: 3600 };
  const release: Release = { id: randomUUID(), candidate: { organizationId: randomUUID(), projectId: randomUUID(), commitSha: labSourceIdentity().revision, deploymentId: randomUUID(), policyId: policy.id, policyVersion: 1, evidenceScope: "REFERENCE_LAB", purpose: "REFERENCE_LAB" },
    provider: "REFERENCE_LAB", providerDeploymentId: "lab-cross-domain", repositoryConnectionId: null, snapshotId: null, environmentId: randomUUID(), environment: "SANDBOX", deploymentCommitSha: labSourceIdentity().revision,
    invariantSetDigest: invariantSetDigest(policy), requestedBy: randomUUID(), createdAt: new Date().toISOString(), baseSha: null, headSha: labSourceIdentity().revision, pullRequest: null, branch: null };
  const binding = { organizationId: release.candidate.organizationId, projectId: release.candidate.projectId, deploymentId: release.candidate.deploymentId, releasePolicy: { releaseId: release.id, policyId: policy.id, policyVersion: 1 } };
  const run = async (index: number, variant: "fixed" | "vulnerable" | "inconclusive") => {
    const p = plans[index], result = await executeCase(p.caseId, variant, { plan: p, releaseBinding: binding });
    const record: ReleaseEvidence = { invariantId: p.spec.id, evidence: result.result.evidence, admission: { kind: "REFERENCE_LAB" }, manifestDigest: evidenceDigest(result.result.evidence),
      authorization: { id: result.grant.authorizationId, expiresAt: new Date(Date.now() + 1800000).toISOString(), revokedAt: null }, testVersion: "lab-test-1", fixtureVersion: 1, planHash: planHash(p) };
    return record;
  };
  const evidence: ReleaseEvidence[] = [];
  for (let i = 0; i < plans.length; i++) evidence.push(await run(i, "fixed"));
  const evaluate = (records = evidence, candidate = release) => evaluateRelease({ release: candidate, policy, evidence: records, now: new Date().toISOString() });
  const a = evaluate(); assert.equal(a.decision, "SHIP"); assert.equal(a.counts.PASS, 8); assert.equal(new Set(evidence.map(e => (e.evidence as {scope:{deploymentId:string}}).scope.deploymentId)).size, 1);
  const badTenant = await run(1, "vulnerable"); const b = [...evidence]; b[1] = badTenant;
  assert.equal(evaluate(b).decision, "BLOCK");
  assert.equal(evaluate(evidence.slice(0, 7)).decision, "INCONCLUSIVE");
  const d = structuredClone(release); d.candidate.commitSha = "d".repeat(40); d.headSha = d.candidate.commitSha; d.deploymentCommitSha = d.headSha;
  assert.equal(evaluate(evidence, d).decision, "INCONCLUSIVE"); assert.equal(evaluate(evidence, d).counts.STALE, 8);
  const fixedReplay = await run(1, "fixed"); const repaired = [...evidence]; repaired[1] = fixedReplay;
  const finding = { id: randomUUID(), invariantId: plans[1].spec.id, invariantVersion: 1, state: "RESOLVED", origin: badTenant, unchangedProof: null, regressionInvariantId: plans[1].spec.id };
  assert.equal(evaluateRelease({ release, policy, evidence: repaired, findings: [finding], now: new Date().toISOString() }).decision, "SHIP");
  assert.equal(evaluateRelease({ release, policy, evidence: b, findings: [finding], now: new Date().toISOString() }).decision, "BLOCK");
  const unavailable = [...repaired]; unavailable[7] = await run(7, "inconclusive");
  assert.equal(evaluate(unavailable).decision, "INCONCLUSIVE");
});
