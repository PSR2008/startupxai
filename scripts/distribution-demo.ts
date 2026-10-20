import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { productLabCatalog } from '../services/product-lab/catalog';
import type { ServiceCommand } from '../services/product-lab/worker';
import { ReleaseWorker } from '../services/releases/worker';
import { Orchestrator } from '../services/orchestrator/orchestrator';
import { LocalArtifacts } from '../services/orchestrator/artifacts';
import { LocalLabProvider, labSourceIdentity } from '../reference-lab/host';
import { browserExchange, humanLogin } from '../packages/cli/src/auth.mjs';
import { remoteClient } from '../packages/cli/src/remote.mjs';
import type { Page } from 'playwright';

/** Uses ordinary product commands and the registered local worker. No proof SQL. */
export async function distributionDemo(input: { base: string; accessToken: string; owner: string; organizationId: string; artifacts: string; command: ServiceCommand; page: Page }) {
  const api = async (path: string, body?: object) => {
    const response = await fetch(`${input.base}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); assert.equal(response.status < 300, true, JSON.stringify(result)); return result.data;
  };
  const getPublic = async (path: string) => { const response = await fetch(`${input.base}/api/public/${path}`); assert.equal(response.status, 200); return response.json(); };
  const fixture = join(input.artifacts, 'distribution-source'); await mkdir(fixture);
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ dependencies: { next: '15', '@supabase/supabase-js': '2' } }));
  await writeFile(join(fixture, 'route.ts'), 'export function GET() { requireProjectAccess(user, project); }');
  const inspected = spawnSync(process.execPath, [resolve('packages/cli/dist/main.mjs'), 'inspect', '--json'], { cwd: fixture, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(inspected.status, 0, inspected.stderr); const assessment = JSON.parse(inspected.stdout);
  assert.equal(assessment.type, 'STATIC_ASSESSMENT'); assert.ok(assessment.recommendations.some((r: { domain: string }) => r.domain === 'tenant_isolation')); assert.match(assessment.disclaimer, /have not yet been proven/);
  let humanCredential = '';
  const store = { async get() { return humanCredential; }, async set(_origin: string, value: string) { humanCredential = value; }, async delete() { humanCredential = ''; } };
  const identity = await humanLogin({ origin: input.base, store, transport: fetch, announce() {}, exchange: (origin: string, announce: (url: string) => void) => browserExchange(origin, announce, (url: string) => { void input.page.goto(url).then(() => input.page.getByRole('button', { name: 'Authorize this CLI', exact: true }).click()); }) });
  assert.equal(identity.userId, input.owner); assert.ok(humanCredential.startsWith('lghu_'));
  const humanClient = remoteClient({ origin: input.base, token: humanCredential, transport: fetch });
  assert.equal((await humanClient('/api/v1/distribution/machine/whoami', {})).userId, input.owner);
  await humanClient('/api/v1/distribution/machine/logout', {}); await store.delete(); assert.equal(humanCredential, '');
  await assert.rejects(humanClient('/api/v1/distribution/machine/whoami', {}));
  const lab = await api(`organizations/${input.organizationId}/reference-lab`, { action: 'CREATE' });
  const project = lab.project_id; await api(`projects/${project}/reference-lab`, { action: 'CONFIRM' });
  const { plans, policy } = productLabCatalog(lab), keys = generateKeyPairSync('ed25519');
  const execution = { command: (action: string, data: Record<string, unknown>) => input.command('lg_execution_service', action, data) };
  const artifacts = new LocalArtifacts(input.artifacts), provider = new LocalLabProvider(keys.publicKey, execution, artifacts), orchestrator = new Orchestrator(execution, provider, keys.privateKey, artifacts);
  const releases = new ReleaseWorker({ command: (a, d) => input.command('lg_release_service', a, d) }, { lab: { identity: labSourceIdentity, plans: new Map(plans.map(plan => [plan.spec.id, { plan, variant: 'fixed' as const }])) } });
  const deployment = await input.command('lg_release_service', 'LAB_DEPLOYMENT', { projectId: project, actorId: input.owner, ...labSourceIdentity() }) as { deploymentId: string };
  const createRelease = async (version: number) => await input.command('lg_release_service', 'CREATE', { projectId: project, actorId: input.owner, policyId: policy.id, policyVersion: version, deploymentId: deployment.deploymentId }) as { id: string };
  const verify = async (id: string) => {
    for (let i = 0; i < 12; i++) { const gate = await releases.tick(); if (gate?.releaseId === id) { assert.equal(gate.decision, 'SHIP'); return; } await orchestrator.tick(); await provider.drain(); }
    throw new Error('DISTRIBUTION_DEMO_GATE_TIMEOUT');
  };
  try {
    const first = await createRelease(1); await verify(first.id);
    const share = await api(`projects/${project}/sharing`, { action: 'SHARE_CREATE', releaseId: first.id, confirm: true });
    const historical = await getPublic(`shares/${share.token}`); assert.equal(historical.decision, 'SHIP');
    for (const forbidden of ['rawEvidence', 'requestBody', 'manifest', 'secret', 'sourceSnippet']) assert.ok(!JSON.stringify(historical).includes(forbidden));
    await input.page.goto(`${input.base}/assurance/share/${share.token}`);
    await input.page.getByRole('heading', { name: 'SHIP', exact: true }).waitFor();
    await input.page.getByText('REFERENCE LAB \u2014 controlled fixture, not customer production assurance.', { exact: true }).waitFor();
    await input.page.screenshot({ path: resolve('.launchgate/phase12-qa/share-desktop.png'), fullPage: true });
    const expiring = await api(`projects/${project}/sharing`, { action: 'SHARE_CREATE', releaseId: first.id, confirm: true, expiresAt: new Date(Date.now() + 5000).toISOString() });
    const setting = await api(`projects/${project}/sharing`, { action: 'PUBLIC_ENABLE', confirm: true });
    assert.equal((await getPublic(`assurance/${setting.slug}`)).state, 'VERIFIED');
    await input.page.goto(`${input.base}/assurance/${setting.slug}`);
    await input.page.getByRole('heading', { name: 'VERIFIED', exact: true }).waitFor();
    await input.page.screenshot({ path: resolve('.launchgate/phase12-qa/assurance-desktop.png'), fullPage: true });
    await input.page.setViewportSize({ width: 390, height: 844 });
    await input.page.screenshot({ path: resolve('.launchgate/phase12-qa/assurance-mobile.png'), fullPage: true });
    await input.page.setViewportSize({ width: 1440, height: 1000 });
    await input.page.goto(`${input.base}/assess`);
    await input.page.getByText('Static analysis only. Runtime business invariants have not yet been proven.', { exact: true }).waitFor();
    await input.page.screenshot({ path: resolve('.launchgate/phase12-qa/assessment-desktop.png'), fullPage: true });
    const badge = await fetch(`${input.base}/api/public/badges/${setting.slug}.svg`); assert.equal(badge.headers.get('Cache-Control'), 'no-store, max-age=0'); assert.match(await badge.text(), /Release Policy Satisfied/);
    await api(`projects/${project}/policies`, { name: 'Distribution demo policy v2', policy: { ...policy, version: 2 } });
    assert.equal((await getPublic(`assurance/${setting.slug}`)).state, 'STALE');
    const second = await createRelease(2); assert.notEqual(second.id, first.id);
    assert.equal((await getPublic(`assurance/${setting.slug}`)).state, 'STALE');
    await verify(second.id); assert.equal((await getPublic(`assurance/${setting.slug}`)).state, 'VERIFIED');
    assert.deepEqual(await getPublic(`shares/${share.token}`), historical);
    assert.equal((await fetch(`${input.base}/api/public/shares/${expiring.token}`)).status, 404);
    await api(`projects/${project}/sharing`, { action: 'SHARE_REVOKE', id: share.id }); assert.equal((await fetch(`${input.base}/api/public/shares/${share.token}`)).status, 404);
    await api(`projects/${project}/sharing`, { action: 'PUBLIC_DISABLE' }); assert.equal((await fetch(`${input.base}/api/public/badges/${setting.slug}.svg`)).status, 404);
    const credential = await api(`projects/${project}/ci-credentials`, { action: 'create', name: 'Demo CI' });
    const machine = await fetch(`${input.base}/api/v1/distribution/machine/check`, { method: 'POST', headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json', 'X-LaunchGate-Protocol': '1' }, body: JSON.stringify({ projectId: project, releaseId: second.id }) });
    assert.equal((await machine.json()).decision, 'SHIP'); await api(`projects/${project}/ci-credentials`, { action: 'revoke', id: credential.id });
    console.log('PASS distribution demo: CLI static → confirmed lab → authoritative SHIP → immutable share → VERIFIED → policy/superseding candidate STALE → new SHIP/VERIFIED → expiry/revocation; CI credential revoked.');
  } finally { await provider.drain().catch(() => {}); for (const result of provider.results.values()) { await provider.terminate(result.bundle.attemptId); await provider.cleanup(result.bundle.attemptId); } }
}
