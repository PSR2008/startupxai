import { opendir, open, realpath, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { ingest, limits, safePath, gitHash } from '../../source-analysis/src/ingestion.mjs';
import { runAnalysis } from '../../source-analysis/src/runner.mjs';

export const disclaimer = 'Static analysis only. Runtime business invariants have not yet been proven.';
const excluded = /^(?:\.git|\.launchgate|node_modules|\.next|dist|build|coverage|vendor|generated)$/i;
export function within(root, target, paths = { relative, isAbsolute, sep }) {
  const rel = paths.relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${paths.sep}`) && !paths.isAbsolute(rel);
}
/** No shell, Git executable, module resolution, config evaluation or repository imports. */
export async function inspect(directory) {
  const root = await realpath(directory), entries = [], blobs = new Map(), localExclusions = [];
  let total = 0, visited = 0, loaded = 0;
  const started = Date.now();
  async function walk(dir, prefix = '') {
    const stream = await opendir(dir);
    for await (const item of stream) {
      if (++visited > limits.treeEntries || Date.now() - started > limits.durationMs) throw new Error('TREE_LIMIT');
      if (excluded.test(item.name)) {
        if (!['.git', '.launchgate'].includes(item.name.toLowerCase())) localExclusions.push({ reason: 'GENERATED' });
        continue;
      }
      const path = prefix + item.name, absolute = resolve(dir, item.name);
      if (!safePath(path)) { entries.push({ path, type: 'unsafe' }); continue; }
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) { entries.push({ path, type: 'blob', mode: '120000' }); continue; }
      const actual = await realpath(absolute);
      if (!within(root, actual) || actual !== absolute) throw new Error('UNSAFE_PATH');
      if (stat.isDirectory()) { await walk(absolute, `${path}/`); continue; }
      if (!stat.isFile()) { entries.push({ path, type: 'special' }); continue; }
      // Do not read credential files, archives, or content that exceeds ingestion bounds.
      if (/^\.env(?:\.|$)/i.test(item.name) || /\.(?:pem|key|p12|zip|tar|gz|tgz|7z|rar)$/i.test(path)) {
        localExclusions.push({ reason: /\.(?:zip|tar|gz|tgz|7z|rar)$/i.test(path) ? 'ARCHIVE_UNSUPPORTED' : 'CREDENTIAL_FILE' }); continue;
      }
      if (stat.size > limits.fileBytes || total + stat.size > limits.totalBytes || loaded >= limits.files) {
        localExclusions.push({ reason: loaded >= limits.files ? 'ANALYSIS_LIMIT' : 'BYTE_LIMIT' }); continue;
      }
      const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      let bytes;
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev || await realpath(absolute) !== actual) throw new Error('SOURCE_CHANGED');
        const buffer = Buffer.alloc(limits.fileBytes + 1);
        let count = 0;
        while (count < buffer.length) {
          const read = await handle.read(buffer, count, buffer.length - count, count);
          if (!read.bytesRead) break;
          count += read.bytesRead;
        }
        if (count !== stat.size || (await handle.stat()).size !== stat.size) throw new Error('SOURCE_CHANGED');
        bytes = buffer.subarray(0, count);
      } finally { await handle.close(); }
      total += bytes.length;
      loaded++;
      const sha = gitHash(bytes); blobs.set(sha, bytes);
      entries.push({ path, type: 'blob', mode: '100644', sha, size: bytes.length });
    }
  }
  await walk(root);
  const input = await ingest(entries, async sha => blobs.get(sha));
  input.coverage.push(...localExclusions);
  if (localExclusions.length) input.status = 'PARTIAL';
  const result = await runAnalysis(input);
  // Public/terminal projection deliberately contains no source, paths or evidence snippets.
  const exclusions = {};
  for (const item of result.coverage.exclusions) exclusions[item.reason] = (exclusions[item.reason] || 0) + 1;
  return {
    schemaVersion: 1, type: 'STATIC_ASSESSMENT', analyzerVersion: result.analysisVersion, disclaimer,
    coverage: { status: result.coverage.status, files: input.files.length, bytes: total, exclusions, diagnostics: result.coverage.diagnostics.length },
    stack: result.stacks.map(({ name, status }) => ({ name, status: status === 'AMBIGUOUS' ? 'REQUIRES_CONFIRMATION' : status })),
    recommendations: result.proposals.map(({ domain, statement }) => ({ domain, statement, status: 'LIKELY_APPLICABLE', confirmationRequired: true })),
    next: 'launchgate init',
  };
}
