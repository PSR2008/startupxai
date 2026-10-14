import { validateReport } from "../../src/server/source-analysis/report";
import { canonical, digest } from "../runner/metadata";
import type { ReleasePolicy } from "./contracts";

export interface SourceSnapshot {
  id: string; connectionId: string; commitSha: string;
  files: Array<{ path: string; digest: string; blobSha: string }>; report: unknown;
}
export interface VerificationDependency {
  invariantId: string; invariantVersion: number; snapshotId: string;
  files: Array<{ path: string; digest: string }>; nodes: string[];
  kind: "FILE" | "ROUTE" | "TABLE" | "POLICY" | "PAYMENT" | "AI" | "QUOTA" | "JOURNEY";
  complete: boolean; provenanceDigest: string;
}
export interface RegressionPriority { invariantId: string; severity: string; state: string; recent: boolean }
export interface ImpactSelection {
  baseSha: string | null; headSha: string; broad: boolean;
  changes: Array<{ path: string; previousPath?: string; kind: "ADDED" | "MODIFIED" | "DELETED" | "RENAMED" }>;
  selected: Array<{ invariantId: string; reasons: string[]; estimatedCost: number; priority: number }>;
  omitted: Array<{ invariantId: string; reason: "UNCHANGED_ADVISORY_DEPENDENCIES"; proofDigest: string }>;
  estimatedCost: number; digest: string;
}
const broadKinds = new Set(["MIDDLEWARE", "MIGRATION", "RLS_POLICY", "RLS_ENABLEMENT", "GRANT", "REVOKE", "SECURITY_DEFINER", "DATABASE_CLIENT", "SERVICE_ROLE_USE", "CREDENTIAL_ENV_USE"]);
const families: Record<string, string[]> = {
  AUTH_BOUNDARY: ["authentication", "authorization", "tenant_isolation", "critical_flows"],
  ROLE_CHECK: ["authorization", "tenant_isolation", "critical_flows"], TENANT_CHECK: ["tenant_isolation", "authorization"],
  ENTITLEMENT_CHECK: ["billing", "webhooks", "paid_features"], PAYMENT_ENDPOINT: ["billing", "webhooks", "paid_features"],
  WEBHOOK_ENDPOINT: ["billing", "webhooks", "paid_features"], QUOTA_CHECK: ["ai_cost", "usage_concurrency"],
  AI_PROVIDER_CALL: ["ai_cost", "usage_concurrency"], PAGE: ["critical_flows"], ROUTE_HANDLER: ["critical_flows"],
};
export function conservativeDependencies(snapshot: SourceSnapshot, policy: ReleasePolicy): VerificationDependency[] {
  const report=validateReport(snapshot.report,snapshot.files);
  const bounded=snapshot.files.length<=200&&report.nodes.length<=200;
  const provenance={snapshotId:snapshot.id,files:snapshot.files.slice(0,200).map(f=>({path:f.path,digest:f.digest})),nodes:report.nodes.slice(0,200).map(n=>n.id)};
  return policy.requirements.map(r=>({...provenance,invariantId:r.invariant.id,invariantVersion:r.invariant.version,kind:r.kind==="JOURNEY"?"JOURNEY":"FILE",complete:bounded&&report.coverage.status==="COMPLETE"&&!report.coverage.exclusions.length&&!report.coverage.diagnostics.length,provenanceDigest:digest(canonical(provenance))}));
}
export function selectVerification(input: { base: SourceSnapshot | null; head: SourceSnapshot; policy: ReleasePolicy; dependencies: VerificationDependency[]; regressions: RegressionPriority[] }): ImpactSelection {
  const { base, head, policy } = input;
  let broad = !base || base.connectionId !== head.connectionId, reason = broad ? "BASE_UNAVAILABLE" : "DEPENDENCY_IMPACT";
  const changed = new Set<string>(), domains = new Set<string>(), nodes = new Set<string>();
  const changes: ImpactSelection["changes"] = [];
  for (const file of head.files) {
    const previous = base?.files.find(f => f.path === file.path);
    if (previous?.digest === file.digest) continue;
    const renamed = !previous && base?.files.find(f => f.digest === file.digest && !head.files.some(h => h.path === f.path));
    changes.push({ path: file.path, ...(renamed ? { previousPath: renamed.path } : {}), kind: previous ? "MODIFIED" : renamed ? "RENAMED" : "ADDED" });
    changed.add(file.path); if (renamed) changed.add(renamed.path);
  }
  for (const file of base?.files ?? []) if (!head.files.some(f => f.path === file.path) && !changes.some(c => c.previousPath === file.path)) { changes.push({ path: file.path, kind: "DELETED" }); changed.add(file.path); }
  try {
    const reports = [validateReport(head.report, head.files), ...(base ? [validateReport(base.report, base.files)] : [])];
    if (reports.some(r => r.coverage.status !== "COMPLETE" || r.coverage.exclusions.length || r.coverage.diagnostics.length)) { broad = true; reason = "PARTIAL_ARCHITECTURE"; }
    for (const path of changed) {
      const related = reports.flatMap(r => r.nodes).filter(n => n.provenance.path === path);
      if (!related.length || /(^|\/)(package(-lock)?\.json|.*lock.*|.*migration.*|.*policy.*|.*shared.*|.*util.*)$/i.test(path)) { broad = true; reason = "UNKNOWN_OR_SHARED_CHANGE"; }
      for (const n of related) {
        nodes.add(n.id);
        if (broadKinds.has(n.kind)) { broad = true; reason = "SHARED_OR_DATABASE_BOUNDARY"; }
        for (const domain of families[n.kind] ?? []) domains.add(domain);
      }
      if (changes.some(c => c.path === path && ["RENAMED", "DELETED", "ADDED"].includes(c.kind)) && related.some(n => n.kind !== "PAGE")) { broad = true; reason = "STRUCTURAL_CHANGE"; }
    }
  } catch { broad = true; reason = "INVALID_ARCHITECTURE_PROVENANCE"; }
  const selected: ImpactSelection["selected"] = [], omitted: ImpactSelection["omitted"] = [];
  for (const r of policy.requirements) {
    const reasons: string[] = [];
    const priority = input.regressions.find(f => f.invariantId === r.invariant.id);
    const deps = input.dependencies.filter(d => d.invariantId === r.invariant.id && d.invariantVersion === r.invariant.version);
    const complete = !!base && deps.length > 0 && deps.every(d => d.complete && d.snapshotId === base.id &&
      d.files.length > 0 && d.provenanceDigest === digest(canonical({ files: d.files, nodes: d.nodes, snapshotId: d.snapshotId })) &&
      d.files.every(f => base.files.some(b => b.path === f.path && b.digest === f.digest)));
    if (r.required) reasons.push("REQUIRED_COVERAGE");
    if (r.baseline) reasons.push("MANDATORY_BASELINE");
    if (broad) reasons.push(reason);
    if (priority && (priority.severity === "critical" || priority.state !== "RESOLVED" || priority.recent)) reasons.push("FINDING_REGRESSION_PRIORITY");
    if (!complete) reasons.push("DEPENDENCIES_INCOMPLETE");
    if (domains.has(r.invariant.domain) || deps.some(d => d.files.some(f => changed.has(f.path)) || d.nodes.some(n => nodes.has(n)))) reasons.push("DEPENDENCY_IMPACT");
    if (reasons.length) selected.push({ invariantId: r.invariant.id, reasons: [...new Set(reasons)].sort(), estimatedCost: r.estimatedCost, priority: priority ? priority.severity === "critical" ? 0 : 1 : r.baseline ? 2 : 3 });
    else omitted.push({ invariantId: r.invariant.id, reason: "UNCHANGED_ADVISORY_DEPENDENCIES", proofDigest: digest(canonical({ base: base!.id, head: head.id, deps })) });
  }
  selected.sort((a,b) => a.priority - b.priority || a.invariantId.localeCompare(b.invariantId));
  changes.sort((a,b) => a.path.localeCompare(b.path));
  const output = { baseSha: base?.commitSha ?? null, headSha: head.commitSha, broad, changes, selected, omitted, estimatedCost: selected.reduce((sum,s) => sum + s.estimatedCost, 0) };
  return { ...output, digest: digest(canonical(output)) };
}
