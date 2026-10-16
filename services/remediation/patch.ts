import ts from "typescript";
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, sep } from "node:path";
import { canonical, digest } from "../runner/metadata";
import { contextSchema, proposalSchema, sourcePath, type RemediationContext, type Proposal } from "./contracts";

const forbiddenPath = /(^|\/)(tests?|__tests__|__snapshots__|migrations|polic(?:y|ies)|workflows|\.github|node_modules)(\/|$)|(?:test|spec)\.[jt]sx?$|(?:oracle|assertion|regression|invariant|authorization-policy)/i;
const secret = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk_(?:live|test)_[a-z0-9]+|gh[pousr]_[a-z0-9]{20,}|service_role|SUPABASE_SERVICE_ROLE_KEY)\b|(?:api[_-]?key|password|secret)\s*[:=]\s*["'][^"']{8,}/i;
const dangerous = /\b(?:eval|exec|execSync|spawn|spawnSync|Function)\s*\(|child_process|https?:\/\/|\bfetch\s*\(|\bXMLHttpRequest\b|\b(?:require|import)\s*\(|(?:admin|owner)\s*[:=]\s*(?:true|["']\*["'])|\b(?:skip|todo|only)\s*\(/i;
export const contextDigest = (context: RemediationContext) => digest(canonical(contextSchema.parse(context)));
export function safeContext(input: unknown) {
  const c = contextSchema.parse(input);
  if (new Set(c.files.map(f => f.path)).size !== c.files.length || c.files.some(f => digest(f.content) !== f.digest)) throw new Error("SOURCE_PROVENANCE");
  // Refuse secret-bearing context entirely; never silently alter patch offsets.
  if (c.files.some(f => secret.test(f.content))) throw new Error("CONTEXT_REQUIRES_REDACTION");
  return c;
}
export interface PatchResult { files: Array<{ path: string; before: string; content: string }>; patchHash: string; contextHash: string; added: number; removed: number }
/** Deliberately small unified-diff grammar. No git commands, fuzzy offsets, binary,
 * renames, deletions, modes, symlinks or executable metadata. */
export function validatePatch(contextInput: unknown, proposalInput: unknown, currentSha: string): PatchResult {
  const c = safeContext(contextInput), p = proposalSchema.parse(proposalInput);
  if (p.sourceSha !== c.sourceSha || currentSha !== c.sourceSha) throw new Error("STALE");
  if (p.findingId !== c.findingId || p.invariantId !== c.invariantId || p.invariantVersion !== c.invariantVersion || p.planHash !== c.planHash || p.contextHash !== contextDigest(c)) throw new Error("PROPOSAL_BINDING");
  if (p.risk !== "BOUNDED") throw new Error("MANUAL_REQUIRED");
  if (p.diff.includes("\r") || p.diff.includes("\0") || !p.diff.endsWith("\n")) throw new Error("MALFORMED_PATCH");
  const lines = p.diff.slice(0, -1).split("\n"), files: PatchResult["files"] = []; let i = 0, added = 0, removed = 0;
  while (i < lines.length) {
    const path = sourcePath.parse(lines[i++]?.match(/^--- a\/(.+)$/)?.[1]);
    if (lines[i++] !== `+++ b/${path}` || forbiddenPath.test(path) || !c.allowedPaths.includes(path) || files.some(f => f.path === path)) throw new Error("PATCH_PATH");
    const original = c.files.find(f => f.path === path);
    if (!original || !original.content.endsWith("\n")) throw new Error("SOURCE_UNAVAILABLE");
    const source = original.content.slice(0, -1).split("\n"), output: string[] = []; let cursor = 0, hunks = 0;
    while (i < lines.length && !lines[i].startsWith("--- a/")) {
      const h = lines[i++]?.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
      if (!h || +h[1] < cursor + 1 || +h[1] > source.length + 1) throw new Error("PATCH_HUNK");
      output.push(...source.slice(cursor, +h[1] - 1)); cursor = +h[1] - 1;
      if (+h[3] !== output.length + 1) throw new Error("PATCH_OFFSET");
      let oldCount = 0, newCount = 0; hunks++;
      while (i < lines.length && !lines[i].startsWith("@@ ") && !lines[i].startsWith("--- a/")) {
        const line = lines[i++], op = line[0], value = line.slice(1);
        if (![" ", "+", "-"].includes(op)) throw new Error("PATCH_SYNTAX");
        if (op !== "+") { if (source[cursor++] !== value) throw new Error("PATCH_DOES_NOT_APPLY"); oldCount++; }
        if (op !== "-") { output.push(value); newCount++; }
        if (op === "+") { added++; if (secret.test(value) || dangerous.test(value)) throw new Error("FORBIDDEN_PATCH"); }
        if (op === "-") removed++;
      }
      if (oldCount !== +h[2] || newCount !== +h[4]) throw new Error("PATCH_COUNT");
    }
    if (!hunks) throw new Error("EMPTY_PATCH");
    output.push(...source.slice(cursor)); const content = output.join("\n") + "\n";
    if (content === original.content || content.trim().length < original.content.trim().length / 2) throw new Error("FEATURE_REMOVAL");
    const parsed = ts.createSourceFile(path, content, ts.ScriptTarget.ES2022, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if ((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length) throw new Error("SOURCE_PARSE");
    files.push({ path, before: original.digest, content });
  }
  if (!files.length || files.length > 4 || added + removed > 160) throw new Error("MANUAL_REQUIRED");
  return { files, patchHash: digest(p.diff), contextHash: contextDigest(c), added, removed };
}
/** Source-only scratch space. Never runs install, build, shell or model code. */
export async function inPatchWorkspace<T>(patch: PatchResult, inspect: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "launchgate-remediation-")), absolute = resolve(root);
  try {
    for (const file of patch.files) {
      sourcePath.parse(file.path); const target = resolve(root, file.path);
      if (!target.startsWith(absolute + sep)) throw new Error("WORKSPACE_SCOPE");
      await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.content, { flag: "wx", mode: 0o600 });
      if ((await lstat(target)).isSymbolicLink() || await readFile(target, "utf8") !== file.content) throw new Error("WORKSPACE_CHANGED");
    }
    return await inspect(root);
  } finally {
    if (resolve(root) !== absolute || !absolute.startsWith(resolve(tmpdir()) + sep + "launchgate-remediation-") || (await lstat(root)).isSymbolicLink()) throw new Error("CLEANUP_SCOPE");
    await rm(absolute, { recursive: true });
  }
}
export function oneLinePatch(path: string, content: string, before: string, after: string) {
  const lines = content.split("\n"), hits = lines.flatMap((line, i) => line === before ? [i] : []);
  if (hits.length !== 1) throw new Error("TEMPLATE_CHANGED");
  const n = hits[0] + 1;
  return `--- a/${path}\n+++ b/${path}\n@@ -${n},1 +${n},1 @@\n-${before}\n+${after}\n`;
}
export function assertProposal(input: Proposal) { return proposalSchema.parse(input); }
