import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { principalFromRequest } from '../src/server/auth/principal';
import { createLaunchGateHandler } from '../src/server/launchgate/api';

async function harness(options: { member?: boolean; decision?: string; state?: string; generation?: number; expiry?: string } = {}) {
  const project = randomUUID(), org = randomUUID(), release = randomUUID(), user = randomUUID(), filters: unknown[][] = [];
  const principal = (await principalFromRequest(new Request('http://local', { headers: { authorization: 'Bearer fixture' } }), async () => ({ userId: user })))!;
  const records: Record<string, unknown> = {
    lg_projects: { id: project, organization_id: org, status: 'ACTIVE' },
    lg_organization_memberships: options.member === false ? null : { id: randomUUID(), organization_id: org, user_id: user, role: 'VIEWER', status: 'ACTIVE' },
    lg_release_candidates: { id: release, project_id: project, commit_sha: 'a'.repeat(40) },
    lg_release_states: { state: options.state ?? 'DECIDED', generation: options.generation ?? 1 },
    lg_gate_evaluations: { generation: 1, decision: options.decision ?? 'SHIP', evaluation: { releaseId: release, decision: options.decision ?? 'SHIP', validUntil: options.expiry ?? '2099-01-01T00:00:00Z', rawEvidence: 'do-not-disclose' } },
  };
  const db = { from(table: string) { const builder = {
    select() { return builder; }, eq(...args: unknown[]) { filters.push([table, ...args]); return builder; }, order() { return builder; }, limit() { return builder; },
    async maybeSingle() { return { data: records[table], error: null }; },
  }; return builder; } } as unknown as SupabaseClient;
  const handler = createLaunchGateHandler(async () => ({ principal, db }));
  const request = (protocol = '1') => handler(new Request(`http://local/api/v1/projects/${project}/distribution/releases/${release}`, { headers: { 'X-LaunchGate-Protocol': protocol } }));
  return { request, project, release, filters };
}
test('machine release read returns only authorized bounded projection', async () => {
  const h = await harness(); const response = await h.request(); const value = await response.json();
  assert.equal(response.status, 200); assert.equal(value.decision, 'SHIP'); assert.equal(value.projectId, h.project);
  assert.equal(value.schemaVersion, 1); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(!JSON.stringify(value).includes('do-not-disclose'));
  assert.ok(h.filters.some(row => row[0] === 'lg_gate_evaluations' && row[1] === 'project_id' && row[2] === h.project));
});
for (const state of ['SUPERSEDED', 'CANCELLED', 'VERIFYING']) test(`machine gate refuses approval for ${state}`, async () => {
  const h = await harness({ state }); assert.equal((await (await h.request()).json()).decision, 'INCONCLUSIVE');
});
test('new generation cannot reuse older SHIP evaluation', async () => {
  const h = await harness({ generation: 2 }); assert.equal((await (await h.request()).json()).decision, 'INCONCLUSIVE');
});
test('expired evaluation is incomplete', async () => {
  const h = await harness({ expiry: '2000-01-01T00:00:00Z' }); assert.equal((await (await h.request()).json()).decision, 'INCONCLUSIVE');
});
test('revoked membership and incompatible protocol are rejected', async () => {
  const denied = await harness({ member: false }); assert.equal((await denied.request()).status, 403);
  assert.ok(!denied.filters.some(row => row[0] === 'lg_gate_evaluations'));
  const h = await harness(); assert.equal((await h.request('2')).status, 422);
});
