import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerifiedPrincipal } from '../auth/principal';
import { requireProjectAccess } from './authorization';
import { authorizationReader, databaseError } from './database';
import { ApiError } from '../http/api-error';

/** Versioned machine projection. Never return raw evidence, finding details or credentials. */
export async function distributionRead(request: Request, session: { principal: VerifiedPrincipal; db: SupabaseClient }, path: string[]) {
  if (request.method !== 'GET' || request.headers.get('X-LaunchGate-Protocol') !== '1') throw new ApiError('INVALID_REQUEST');
  const projectId = z.string().uuid().parse(path[1]);
  await requireProjectAccess(authorizationReader(session.db), session.principal, projectId);
  if (path.length !== 5 || path[3] !== 'releases') throw new ApiError('INVALID_REQUEST');
  const releaseId = z.string().uuid().parse(path[4]);
  const release = await session.db.from('lg_release_candidates').select('id,project_id,commit_sha').eq('project_id', projectId).eq('id', releaseId).maybeSingle();
  databaseError(release.error);
  if (!release.data) throw new ApiError('ACCESS_DENIED');
  const gate = await session.db.from('lg_gate_evaluations').select('generation,decision,evaluation').eq('project_id', projectId).eq('release_id', releaseId).order('generation', { ascending: false }).limit(1).maybeSingle();
  databaseError(gate.error);
  // Read the mutable generation after immutable evaluation data. A concurrent
  // re-evaluation must not let an earlier DECIDED observation authorize old proof.
  const state = await session.db.from('lg_release_states').select('state,generation').eq('project_id', projectId).eq('release_id', releaseId).maybeSingle();
  databaseError(state.error);
  const evaluation = z.object({ releaseId: z.string().uuid(), decision: z.enum(['SHIP', 'BLOCK', 'INCONCLUSIVE']), validUntil: z.string().datetime().nullable() }).safeParse(gate.data?.evaluation);
  let decision = 'INCONCLUSIVE', validUntil: string | null = null;
  if (evaluation.success && evaluation.data.releaseId === releaseId && gate.data?.decision === evaluation.data.decision && state.data?.state === 'DECIDED' && state.data.generation === gate.data?.generation) {
    decision = evaluation.data.decision; validUntil = evaluation.data.validUntil;
    if (decision === 'SHIP' && (!validUntil || Date.parse(validUntil) <= Date.now())) decision = 'INCONCLUSIVE';
  }
  return Response.json({ schemaVersion: 1, type: 'RELEASE_CHECK', projectId, releaseId, commitSha: release.data.commit_sha, decision, validUntil }, { headers: { 'Cache-Control': 'no-store' } });
}
