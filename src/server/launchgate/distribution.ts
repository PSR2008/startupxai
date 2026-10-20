import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { distributionService } from '../distribution/store';
import { ApiError } from '../http/api-error';
import { boundedBody } from '../github/provider';
import { databaseError } from './database';
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function distributionBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError('INVALID_REQUEST');
  try { return JSON.parse(Buffer.from(await boundedBody(new Response(request.body), 16384)).toString('utf8')); } catch { throw new ApiError('INVALID_REQUEST'); }
}
export async function machineRoute(request: Request, path: string[], service?: Pick<SupabaseClient, 'rpc'>) {
  if (request.headers.get('X-LaunchGate-Protocol') !== '1' || request.method !== 'POST' || path.length !== 3) throw new ApiError('INVALID_REQUEST');
  const match = /^Bearer (lgci_|lghu_)([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new ApiError('AUTHENTICATION_REQUIRED');
  const db = service ?? distributionService();
  const input = z.object({ projectId: z.string().uuid().nullable().default(null), releaseId: z.string().uuid().optional(), commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(), baseSha: z.string().regex(/^[a-f0-9]{40}$/).nullable().optional() }).strict().parse(await distributionBody(request));
  const actions: Record<string, string> = { check: 'CHECK', reconcile: 'RECONCILE', releases: 'RELEASES', findings: 'FINDINGS', whoami: 'WHOAMI', logout: 'LOGOUT' };
  const action = actions[path[2]];
  if (!action || action === 'CHECK' && !input.releaseId || action === 'RECONCILE' && !input.commitSha) throw new ApiError('INVALID_REQUEST');
  const result = await db.rpc('lg_distribution_machine', { p_kind: match[1] === 'lgci_' ? 'CI' : 'HUMAN', p_hash: tokenHash(match[1] + match[2]), p_project: input.projectId, p_action: action, p_data: input });
  databaseError(result.error);
  if (['CHECK', 'RECONCILE'].includes(action) && request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1') await db.rpc('lg_public_distribution', { p_action: 'TELEMETRY', p_data: { event: action === 'RECONCILE' ? 'github_action_check' : 'cli_check' } });
  return Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
}
export async function credentialRoute(request: Request, db: SupabaseClient, path: string[], correlation: string) {
  const human = path[0] === 'cli-sessions';
  if (path.length !== (human ? 1 : 3)) throw new ApiError('INVALID_REQUEST');
  const project = human ? null : z.string().uuid().parse(path[1]);
  if (request.method === 'GET') {
    const columns = human ? 'id,created_at,expires_at,revoked_at,last_used_at' : 'id,name,project_id,created_at,expires_at,revoked_at,last_used_at';
    let query = db.from(human ? 'lg_cli_sessions' : 'lg_ci_credentials').select(columns).order('created_at', { ascending: false }).limit(50);
    if (project) query = query.eq('project_id', project);
    const result = await query; databaseError(result.error);
    return Response.json({ ok: true, data: result.data }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (request.method !== 'POST') throw new ApiError('INVALID_REQUEST');
  const input = z.object({ action: z.enum(['create', 'rotate', 'revoke']), id: z.string().uuid().optional(), name: z.string().regex(/^[A-Za-z0-9 _.-]{1,80}$/).optional(), expiresAt: z.string().datetime().optional() }).strict().parse(await distributionBody(request));
  if (input.action !== 'create' && !input.id || human && input.action === 'rotate') throw new ApiError('INVALID_REQUEST');
  const token = (human ? 'lghu_' : 'lgci_') + randomBytes(32).toString('hex');
  const action = (human ? 'HUMAN_' : 'CI_') + input.action.toUpperCase();
  const result = await db.rpc('lg_distribution_identity', { p_project: project, p_action: action, p_data: { ...input, hash: tokenHash(token), name: input.name ?? 'CI', expiresAt: input.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString() }, p_correlation: correlation });
  databaseError(result.error);
  return Response.json({ ok: true, data: { ...result.data, ...(input.action !== 'revoke' ? { token } : {}) } }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
export async function sharingRoute(request: Request, db: SupabaseClient, path: string[], correlation: string) {
  if (path.length !== 3) throw new ApiError('INVALID_REQUEST');
  const project = z.string().uuid().parse(path[1]);
  if (request.method === 'GET') {
    const shares = await db.from('lg_release_shares').select('id,evaluation_id,created_at,expires_at,revoked_at').eq('project_id', project).order('created_at', { ascending: false }).limit(50);
    const settings = await db.from('lg_public_assurance_settings').select('slug,enabled').eq('project_id', project).maybeSingle();
    databaseError(shares.error); databaseError(settings.error);
    return Response.json({ ok: true, data: { shares: shares.data, settings: settings.data } }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (request.method !== 'POST') throw new ApiError('INVALID_REQUEST');
  const input = z.object({ action: z.enum(['SHARE_CREATE', 'SHARE_REVOKE', 'PUBLIC_ENABLE', 'PUBLIC_DISABLE']), confirm: z.boolean().optional(), releaseId: z.string().uuid().optional(), id: z.string().uuid().optional(), expiresAt: z.string().datetime().nullable().optional() }).strict().parse(await distributionBody(request));
  if (input.action === 'SHARE_CREATE' && (!input.releaseId || !input.confirm) || input.action === 'SHARE_REVOKE' && !input.id) throw new ApiError('INVALID_REQUEST');
  const token = randomBytes(32).toString('hex');
  const result = await db.rpc('lg_sharing_command', { p_project: project, p_action: input.action, p_data: { ...input, hash: tokenHash(token), slug: randomBytes(16).toString('hex') }, p_correlation: correlation });
  databaseError(result.error);
  if (input.action === 'SHARE_CREATE' && request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1') await distributionService().rpc('lg_public_distribution', { p_action: 'TELEMETRY', p_data: { event: 'share_created' } });
  return Response.json({ ok: true, data: { ...result.data, ...(input.action === 'SHARE_CREATE' ? { token } : {}) } }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
