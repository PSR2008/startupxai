import { analyze } from "@launchgate/source-analysis/engine";
import { gitHash } from "@launchgate/source-analysis";
import { validateReport } from "../../src/server/source-analysis/report";
import { canonical, digest } from "../runner/metadata";
import type { SourceSnapshot } from "../releases/impact";
/** Reuses Phase 3 syntax-only observations; never executes repository scripts. */
export function patchArchitecture(files: Array<{ path: string; content: string }>, revision: string, id: string): SourceSnapshot {
  const source = files.map(f => ({ path: f.path, text: f.content, digest: digest(f.content).slice(7), blobSha: gitHash(Buffer.from(f.content)), classification: "SOURCE" }));
  const report = validateReport(analyze({ files: source, status: "COMPLETE", coverage: [] }), source);
  if (report.coverage.status !== "COMPLETE") throw new Error("PATCH_ARCHITECTURE_UNCERTAIN");
  return { id, connectionId: "REGISTERED_REFERENCE_LAB", commitSha: revision, files: source.map(({ path, digest, blobSha }) => ({ path, digest, blobSha })), report };
}
export function architectureDigest(files: Array<{ path: string; content: string }>) {
  return digest(canonical(patchArchitecture(files, "0".repeat(40), "context").report));
}
