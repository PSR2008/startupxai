import { z } from 'zod';
import { ingest, hash } from '@launchgate/source-analysis';
import { runAnalysis } from '@launchgate/source-analysis/runner';
import { boundedBody } from '../../src/server/github/provider';
export const STATIC_DISCLAIMER = 'Static analysis only. Runtime business invariants have not yet been proven.';
export const ASSESSMENT_VERSION = 'lg-static-1';
export function repositoryInput(input: string) {
  let value = input.trim();
  if (value.startsWith('https://')) {
    const url = new URL(value);
    if (url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('INVALID_REPOSITORY');
    value = url.pathname.slice(1).replace(/\/$/, '');
  }
  const match = /^([A-Za-z0-9_-]{1,39})\/([A-Za-z0-9_.-]{1,100})$/.exec(value);
  if (!match || ['.', '..'].includes(match[2])) throw new Error('INVALID_REPOSITORY');
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
}
export function assessmentKey(repositoryId: number, commitSha: string, version = ASSESSMENT_VERSION) {
  return hash(JSON.stringify([repositoryId, commitSha, version, 1, 'public-bounds-1']));
}
export function staticProjection(result: Awaited<ReturnType<typeof runAnalysis>>) {
  const report = result as { analysisVersion: string; stacks: { name: string; status: string }[]; proposals: { domain: string; statement: string }[]; nodes: { kind: string }[]; coverage: { status: string; exclusions: { reason: string }[]; diagnostics: unknown[] } };
  return { schemaVersion: 1, type: 'STATIC_ASSESSMENT', disclaimer: STATIC_DISCLAIMER, analyzerVersion: report.analysisVersion,
    stack: report.stacks.map(s => ({ name: s.name, status: s.status === 'AMBIGUOUS' ? 'REQUIRES_CONFIRMATION' : s.status })),
    recommendations: report.proposals.map(p => ({ domain: p.domain, statement: p.statement, status: 'LIKELY_APPLICABLE' })),
    surfaces: [...new Set(report.nodes.map(n => n.kind))].slice(0, 40).map(kind => ({ kind, status: 'REQUIRES_CONFIRMATION' })),
    coverage: { status: report.coverage.status, excludedCount: report.coverage.exclusions.length, diagnosticsCount: report.coverage.diagnostics.length },
  };
}
export class PublicRepositoryReader {
  private requests = 0;
  private signal = AbortSignal.timeout(30000);
  constructor(private transport: typeof fetch = fetch) {}
  private async request(path: string) {
    if (++this.requests > 30 || !path.startsWith('/repos/')) throw new Error('ASSESSMENT_LIMIT');
    const response = await this.transport(`https://api.github.com${path}`, { redirect: 'error', signal: this.signal, headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) { await response.body?.cancel(); throw new Error([403, 429].includes(response.status) ? 'PROVIDER_BACKOFF' : 'REPOSITORY_UNAVAILABLE'); }
    return JSON.parse(Buffer.from(await boundedBody(response, 2097152)).toString('utf8'));
  }
  async resolve(input: string) {
    const requested = repositoryInput(input);
    const repo = z.object({ id: z.number().int().positive().safe(), full_name: z.string(), private: z.literal(false), visibility: z.literal('public').optional(), size: z.number().nonnegative().max(20480), default_branch: z.string().min(1).max(255) }).parse(await this.request(`/repos/${requested}`));
    const repository = repositoryInput(repo.full_name);
    const commit = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/), commit: z.object({ tree: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }) }) }).parse(await this.request(`/repos/${repository}/commits/${encodeURIComponent(repo.default_branch)}`));
    return { repository, repositoryId: repo.id, commitSha: commit.sha, treeSha: commit.commit.tree.sha, cacheKey: assessmentKey(repo.id, commit.sha) };
  }
  async analyze(identity: Awaited<ReturnType<PublicRepositoryReader['resolve']>>) {
    const tree = z.object({ sha: z.string(), truncated: z.boolean(), tree: z.array(z.object({ path: z.string().max(4096), mode: z.string(), type: z.string(), sha: z.string(), size: z.number().optional() })).max(2000) }).parse(await this.request(`/repos/${identity.repository}/git/trees/${identity.treeSha}?recursive=1`));
    if (tree.sha !== identity.treeSha) throw new Error('TREE_IDENTITY_MISMATCH');
    const source = await ingest(tree.tree, async (sha: string) => {
      const blob = z.object({ sha: z.string(), encoding: z.literal('base64'), content: z.string().max(100000).regex(/^[A-Za-z0-9+/=\r\n]*$/), size: z.number().int().max(65536) }).parse(await this.request(`/repos/${identity.repository}/git/blobs/${sha}`));
      const bytes = Buffer.from(blob.content, 'base64');
      if (blob.sha !== sha || bytes.length !== blob.size) throw new Error('BLOB_IDENTITY_MISMATCH');
      return bytes;
    }, { truncated: tree.truncated, limits: { files: 24 } });
    const result = staticProjection(await runAnalysis(source));
    return { ...result, repository: identity.repository, repositoryId: identity.repositoryId, commitSha: identity.commitSha, assessedAt: new Date().toISOString() };
  }
}
