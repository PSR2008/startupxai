import type { Release, Requirement } from "./contracts";
import type { SourceSnapshot, VerificationDependency } from "./impact";
import { validateReport } from "../../src/server/source-analysis/report";
import { canonical, digest } from "../runner/metadata";
// Unchanged-code applicability is proved over a persisted, operator-confirmed
// transitive dependency set and two authenticated snapshots, never diff text.
export function unchangedDependencyProof(release: Release, requirement: Requirement, origin: SourceSnapshot, head: SourceSnapshot, mappings: VerificationDependency[]) {
  try {
    if (release.snapshotId !== head.id || release.candidate.commitSha !== head.commitSha || release.repositoryConnectionId !== head.connectionId || origin.connectionId !== head.connectionId) return null;
    const before = validateReport(origin.report, origin.files), after = validateReport(head.report, head.files);
    if ([before, after].some(r => r.coverage.status !== "COMPLETE" || r.coverage.exclusions.length || r.coverage.diagnostics.length)) return null;
    const deps = mappings.filter(d => d.invariantId === requirement.invariant.id && d.invariantVersion === requirement.invariant.version && d.snapshotId === origin.id);
    if (!deps.length || deps.some(d => !d.complete || !d.files.length || d.provenanceDigest !== digest(canonical({ files: d.files, nodes: d.nodes, snapshotId: d.snapshotId })) ||
      d.files.some(f => !origin.files.some(o => o.path === f.path && o.digest === f.digest) || !head.files.some(h => h.path === f.path && h.digest === f.digest)) || d.nodes.some(n => !before.nodes.some(node => node.id === n && d.files.some(f => f.path === node.provenance.path))))) return null;
    return { releaseId: release.id, invariantVersion: requirement.invariant.version, complete: true, digest: digest(canonical({ origin: origin.id, head: head.id, deps })) };
  } catch { return null; }
}
