import { architectureDigest } from "../services/remediation/architecture";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { digest } from "../services/runner/metadata";
import { labSourceIdentity } from "../reference-lab/host";
import { makePlan, executeCase } from "./fixtures/dynamic-lab";
import { planHash } from "../reference-lab/plans";
import { DeterministicRemediationProvider, templateSource, validateAutomaticPatch, generateProposal, type SupportedCase } from "../services/remediation/provider";
import { contextDigest, validatePatch, inPatchWorkspace, oneLinePatch } from "../services/remediation/patch";
import { withRegisteredPreview } from "../services/remediation/preview";
import type { RemediationContext } from "../services/remediation/contracts";

function context(caseId: SupportedCase): RemediationContext {
  const plan = makePlan(caseId), file = templateSource(caseId).file;
  return { organizationId: randomUUID(), projectId: randomUUID(), findingId: randomUUID(), invariantId: plan.spec.id, invariantVersion: 1, sourceSha: labSourceIdentity().revision,
    deploymentId: randomUUID(), connectionId: null, planHash: planHash(plan), originalManifest: digest("test-origin"), reproduced: true,
    files: [file], allowedPaths: [file.path], provenance: "REGISTERED_REFERENCE_LAB", caseId, architectureDigest: architectureDigest([file]) };
}
const provider = new DeterministicRemediationProvider();
test("narrow patch applies only to exact source and scratch workspace is removed", async () => {
  const c = context("tenant.read"), p = await generateProposal(provider, c), result = validateAutomaticPatch(c, p, c.sourceSha);
  assert.equal(result.added, 1); assert.equal(result.removed, 1); let root = "";
  await inPatchWorkspace(result, async path => { root = path; await access(path); }); await assert.rejects(access(root));
  assert.throws(() => validatePatch(c, p, "a".repeat(40)), /STALE/);
  assert.throws(() => validatePatch(c, { ...p, contextHash: digest("other") }, c.sourceSha), /BINDING/);
});
for (const [name, mutate] of Object.entries({
  traversal: (d: string) => d.replaceAll("reference-lab/runtime.ts", "../runtime.ts"),
  binary: () => "GIT binary patch\nliteral 1\nx\n",
  workflow: (d: string) => d.replaceAll("reference-lab/runtime.ts", ".github/workflows/test.ts"),
  unrelated: (d: string) => d.replaceAll("reference-lab/runtime.ts", "src/user.ts"),
  "test deletion": (d: string) => d.replaceAll("reference-lab/runtime.ts", "tests/security.test.ts"),
  "hunk mismatch": (d: string) => d.replace("@@ -", "@@ -9"),
  "unsafe eval": (d: string) => d.replace('+   if(!permitted)', '+   eval("user"); if(!permitted)'),
  "secret insertion": (d: string) => d.replace('+   if(!permitted)', '+   const key="SUPABASE_SERVICE_ROLE_KEY"; if(!permitted)'),
  exfiltration: (d: string) => d.replace('+   if(!permitted)', '+   fetch("https://external.invalid"); if(!permitted)'),
  "feature disablement": (d: string) => d.replace('+   if(!permitted)', '+   if(true)'),
  "admin bypass": (d: string) => d.replace('+   if(!permitted)', '+   if(false)'),
  "assertion weakening": (d: string) => d.replace('+   if(!permitted)', '+   // if(!permitted)'),
  "shell execution": (d: string) => d.replace('+   if(!permitted)', '+   exec("command"); if(!permitted)'),
})) test(`malicious patch rejected: ${name}`, async () => {
  const c = context("tenant.read"), p = await generateProposal(provider, c);
  assert.throws(() => validateAutomaticPatch(c, { ...p, diff: mutate(p.diff) }, c.sourceSha));
});
test("provider errors, malformed output and untrusted context cannot validate", async () => {
  const c = context("tenant.read");
  await assert.rejects(generateProposal({ async propose() { throw new Error("unavailable"); } }, c));
  await assert.rejects(generateProposal({ async propose() { return { resolved: true }; } }, c));
  await assert.rejects(generateProposal(provider, { ...c, files: [{ ...c.files[0], content: "changed" }] }));
});
test("workspace cleanup also runs after validation failure", async () => {
  const c = context("tenant.read"), p = await generateProposal(provider, c); let root = "";
  await assert.rejects(inPatchWorkspace(validatePatch(c, p, c.sourceSha), async path => { root = path; throw new Error("inspection failed"); }));
  await assert.rejects(access(root));
});
test("massive rewrite cannot be automatic even with parsable source", async () => {
  const c = context("tenant.read"), p = await generateProposal(provider, c), t = templateSource(c.caseId).template;
  const diff = oneLinePatch(t.path, c.files[0].content, t.before, Array.from({ length: 180 }, () => "+const unrelated = 0;\n").join(""));
  assert.throws(() => validateAutomaticPatch(c, { ...p, diff }, c.sourceSha));
});
for (const caseId of ["tenant.read", "role.member_owner", "billing.duplicate", "ai.quota"] as const) test(`actual patched ${caseId} preview preserves original oracle and controls`, async () => {
  const c = context(caseId), plan = makePlan(caseId); c.invariantId = plan.spec.id; c.planHash = planHash(plan);
  const original = await executeCase(caseId, "vulnerable", { plan });
  assert.equal(original.result.evaluation.outcome, "REPRODUCIBLE_FAILURE"); c.originalManifest = original.result.manifestDigest;
  const p = await generateProposal(provider, c); assert.equal(p.contextHash, contextDigest(c));
  await withRegisteredPreview(c, p, c.sourceSha, async preview => {
    assert.notEqual(preview.identity().revision, c.sourceSha);
    const fixed = await executeCase(caseId, "vulnerable", { plan, preview });
    assert.equal(fixed.result.evaluation.outcome, "PASS");
    assert.equal(fixed.result.evidence.scope.commitSha, preview.identity().revision);
    assert.ok(fixed.result.evidence.original.preconditions.every(v => v.passed));
    const adjacent={"tenant.read":"tenant.write","role.member_owner":"role.member_admin","billing.duplicate":"billing.concurrent","ai.quota":"ai.concurrent"} as const;
    const adjacentResult=await executeCase(adjacent[caseId],"vulnerable",{preview});
    assert.equal(adjacentResult.result.evaluation.outcome,"PASS");
  });
  const recurrence = await executeCase(caseId, "vulnerable", { plan }); assert.equal(recurrence.result.evaluation.outcome, "REPRODUCIBLE_FAILURE");
});
