import 'server-only';
import { z } from 'zod';
import { distributionBody, tokenHash } from './distribution';
import { distributionService, anonymousQuotaIdentity } from '../distribution/store';
import { databaseError } from './database';
import { PublicRepositoryReader } from '../../../services/distribution/assessment';
import { badgeSvg, badgeStates } from '../../../services/distribution/badge';
import type { SupabaseClient } from '@supabase/supabase-js';

const headers = { 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export async function publicDistribution(request: Request, dependencies?: { db: SupabaseClient; reader?: () => PublicRepositoryReader }) {
  const respond = (data: unknown, status = 200) => Response.json(data, { status, headers });
  let cache: { key: string; lease: string } | undefined;
  const db = dependencies?.db ?? distributionService();
  const repositoryReader = dependencies?.reader ?? (() => new PublicRepositoryReader());
  const command = async (action: string, data: Record<string, unknown>) => { const result = await db.rpc('lg_public_distribution', { p_action: action, p_data: data }); databaseError(result.error); return result.data; };
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\/public\//, '').split('/');
    const surface = path[0] === 'assess' ? 'assessment' : 'public';
    // Only the managed Vercel proxy's overwritten header is trusted. Other
    // deployments use a shared conservative quota, never arbitrary forwarded IPs.
    const client = anonymousQuotaIdentity(request);
    if (!(await command('RATE', { surface, client })).allowed) return respond({ error: 'TRY_LATER' }, 429);
    const telemetry = async (event: string) => { if (request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1') await command('TELEMETRY', { event }); };
    if (request.method === 'POST' && path.length === 1 && path[0] === 'assess') {
      const { repository } = z.object({ repository: z.string().min(3).max(200) }).strict().parse(await distributionBody(request));
      const reader = repositoryReader(), identity = await reader.resolve(repository);
      const claim = await command('CACHE_CLAIM', { key: identity.cacheKey });
      if (claim.cached) { await telemetry('public_assessment'); return respond(claim.cached); }
      if (claim.busy) return respond({ error: 'TRY_LATER' }, 429);
      cache = { key: identity.cacheKey, lease: claim.lease };
      const result = await reader.analyze(identity);
      await command('CACHE_COMPLETE', { ...cache, result }); cache = undefined;
      await telemetry('public_assessment'); return respond(result);
    }
    if (request.method === 'POST' && path.length === 1 && path[0] === 'telemetry') {
      const { event } = z.object({ event: z.enum(['cli_init', 'cli_inspect', 'cli_check', 'github_action_check', 'assessment_connect_cta']) }).strict().parse(await distributionBody(request));
      await telemetry(event); return respond({ accepted: true });
    }
    if (request.method !== 'GET' || path.length !== 2) return respond({ error: 'UNAVAILABLE' }, 404);
    if (path[0] === 'shares' && /^[a-f0-9]{64}$/.test(path[1])) {
      const result = await command('SHARE', { hash: tokenHash(path[1]) });
      if (!result) return respond({ error: 'UNAVAILABLE' }, 404);
      await telemetry('public_assurance_view'); return respond(result);
    }
    if (['badges', 'assurance'].includes(path[0])) {
      const slug = path[0] === 'badges' ? path[1].replace(/\.svg$/, '') : path[1];
      if (!/^[a-f0-9]{32}$/.test(slug)) return respond({ error: 'UNAVAILABLE' }, 404);
      const identity = await command('PUBLIC_IDENTITY', { slug });
      if (!identity) return respond({ error: 'UNAVAILABLE' }, 404);
      let currentSha: string | null = null;
      if (identity.purpose !== 'REFERENCE_LAB') {
        if (!identity.repository) return respond({ error: 'UNAVAILABLE' }, 404);
        try { currentSha = (await repositoryReader().resolve(identity.repository)).commitSha; }
        catch { return respond({ error: 'UNAVAILABLE' }, 503); }
      }
      const result = await command('BADGE', { slug, currentSha });
      if (!result) return respond({ error: 'UNAVAILABLE' }, 404);
      await telemetry(path[0] === 'badges' ? 'badge_view' : 'public_assurance_view');
      if (path[0] === 'badges') return new Response(badgeSvg(z.enum(badgeStates).parse(result.state)), { headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'none'; sandbox" } });
      return respond(result);
    }
    return respond({ error: 'UNAVAILABLE' }, 404);
  } catch (error) {
    if (cache) await command('CACHE_FAIL', cache).catch(() => {});
    if (error instanceof Error && error.message === 'PROVIDER_BACKOFF') await command('BACKOFF', {}).catch(() => {});
    return respond({ error: 'ASSESSMENT_OR_RESOURCE_UNAVAILABLE' }, 422);
  }
}
