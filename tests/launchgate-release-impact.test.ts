import assert from "node:assert/strict";
import { test } from "node:test";
import { selectVerification, type SourceSnapshot, type VerificationDependency } from "../services/releases/impact";
import { canonical, digest } from "../services/runner/metadata";
import { releaseFixture } from "./fixtures/release";
function snapshot(path: string, kind: string, version: string): SourceSnapshot {
  const file = { path, digest: version.repeat(64), blobSha: version.repeat(40) };
  return { id: version, connectionId: "connection", commitSha: version.repeat(40), files: [file], report: { analysisVersion: "lg-static-1", kind: "STATIC_OBSERVATIONS", coverage: { status: "COMPLETE", exclusions: [], diagnostics: [] },
    stacks: ["Next.js", "React", "Supabase", "PostgreSQL", "Stripe", "Razorpay", "Vercel", "OpenAI", "Anthropic"].map(name => ({ name, status: "NOT_DETECTED", evidence: [] })),
    nodes: [{ id: version.repeat(32), kind, detail: "fixture", provenance: { ...file, startLine: 1, endLine: 1 } }], edges: [], proposals: [] } };
}
for (const [name, kind, broad] of [["auth", "AUTH_BOUNDARY", false], ["billing", "WEBHOOK_ENDPOINT", false], ["quota", "QUOTA_CHECK", false], ["middleware", "MIDDLEWARE", true], ["migration", "RLS_POLICY", true], ["unknown", "UNKNOWN", true]] as const)
  test(`impact ${name} retains required coverage and ${broad ? "broadens" : "correlates"} analysis`, () => {
    const result = selectVerification({ base: snapshot("src/change.ts", kind, "a"), head: snapshot("src/change.ts", kind, "b"), policy: releaseFixture().policy, dependencies: [], regressions: [] });
    assert.equal(result.broad, broad); assert.equal(result.selected.length, 1); assert.ok(result.selected[0].reasons.includes("REQUIRED_COVERAGE"));
  });
test("safe UI change narrows only proven unchanged advisory dependencies", () => {
  const f = releaseFixture(), base = snapshot("src/page.tsx", "PAGE", "a"), head = snapshot("src/page.tsx", "PAGE", "b");
  const other = { path: "src/advisory.ts", digest: "c".repeat(64), blobSha: "c".repeat(40) }; base.files.push(other); head.files.push(other);
  f.policy.requirements.push({ ...f.policy.requirements[0], required: false, baseline: false, invariant: { ...f.policy.requirements[0].invariant, id: "advisory" } });
  const provenance = { snapshotId: base.id, files: [{ path: other.path, digest: other.digest }], nodes: [] };
  const dependency: VerificationDependency = { ...provenance, invariantId: "advisory", invariantVersion: 1, kind: "FILE", complete: true, provenanceDigest: digest(canonical(provenance)) };
  const result = selectVerification({ base, head, policy: f.policy, dependencies: [dependency], regressions: [] });
  assert.equal(result.broad, false); assert.equal(result.selected.length, 1); assert.equal(result.omitted[0].invariantId, "advisory");
  const priority = selectVerification({ base, head, policy: f.policy, dependencies: [dependency], regressions: [{ invariantId: "advisory", severity: "critical", state: "RESOLVED", recent: false }] });
  assert.equal(priority.selected.length, 2); assert.equal(priority.selected[0].invariantId, "advisory");
});
for (const change of ["rename", "delete", "new-route", "manifest", "missing-base", "partial"])
  test(`impact ${change} conservatively broadens`, () => {
    const base = snapshot("src/route.ts", "ROUTE_HANDLER", "a"), head = snapshot("src/route.ts", "ROUTE_HANDLER", "b");
    if (change === "rename") { head.files[0].path = "src/renamed.ts"; head.files[0].digest = base.files[0].digest; }
    if (change === "delete") head.files = [];
    if (change === "new-route") base.files = [];
    if (change === "manifest") head.files.push({ path: "package.json", digest: "c".repeat(64), blobSha: "c".repeat(40) });
    if (change === "partial") (head.report as {coverage:{status:string}}).coverage.status = "PARTIAL";
    assert.equal(selectVerification({ base: change === "missing-base" ? null : base, head, policy: releaseFixture().policy, dependencies: [], regressions: [] }).broad, true);
  });
