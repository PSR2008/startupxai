import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteClient, releaseResult, serverOrigin } from '../src/remote.mjs';
const identity = { projectId: 'project', releaseId: 'release', commitSha: 'a'.repeat(40) };
for (const [decision, exitCode] of [['SHIP', 0], ['BLOCK', 1], ['INCONCLUSIVE', 2]]) {
  test(`authoritative ${decision} maps to exit ${exitCode}`, () => {
    assert.equal(releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, decision, validUntil: '2099-01-01T00:00:00Z', evidence: 'secret' }, identity).exitCode, exitCode);
  });
}
test('expired and invalid expiry never approve a SHIP', () => {
  for (const validUntil of [null, 'invalid', '2000-01-01T00:00:00Z']) {
    const result = releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, decision: 'SHIP', validUntil }, identity);
    assert.equal(result.exitCode, 2); assert.equal(result.output.decision, 'INCONCLUSIVE');
  }
});
test('exact SHA, project and release identity must match', () => {
  for (const field of ['projectId', 'releaseId', 'commitSha']) assert.throws(() => releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, [field]: 'wrong', decision: 'BLOCK' }, identity), /RELEASE_IDENTITY_MISMATCH/);
});
test('remote response projection strips private payloads', () => {
  const result = releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, decision: 'BLOCK', validUntil: null, evidence: 'secret', token: 'never' }, identity);
  assert.ok(!JSON.stringify(result).includes('secret')); assert.ok(!JSON.stringify(result).includes('never'));
});
test('server origin rejects credential URLs, paths and non-TLS remote hosts', () => {
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?token=secret', 'file:///tmp/a']) assert.throws(() => serverOrigin(url));
  assert.equal(serverOrigin('https://example.com'), 'https://example.com');
  assert.equal(serverOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
});
test('requests disable redirects and do not disclose network errors', async () => {
  const client = remoteClient({ origin: 'https://example.com', token: 'x'.repeat(32), transport: async (_url, options) => { assert.equal(options.redirect, 'error'); throw new Error('sensitive diagnostic'); } });
  await assert.rejects(client('/api/v1/projects/id'), { message: 'SERVER_UNAVAILABLE', exitCode: 4 });
});
test('missing auth, incompatible schema, server failure and cancellation fail closed', async () => {
  assert.throws(() => remoteClient({ origin: 'https://example.com' }), /AUTHENTICATION_REQUIRED/);
  const make = transport => remoteClient({ origin: 'https://example.com', token: 'x'.repeat(32), transport });
  await assert.rejects(make(async () => Response.json({ schemaVersion: 2 }))('/api/v1/test'), { message: 'INCOMPATIBLE_PROTOCOL', exitCode: 5 });
  await assert.rejects(make(async () => new Response('', { status: 401 }))('/api/v1/test'), { exitCode: 3 });
  await assert.rejects(make(async () => new Response('', { status: 500 }))('/api/v1/test'), { exitCode: 4 });
  const client = remoteClient({ origin: 'https://example.com', token: 'x'.repeat(32), signal: AbortSignal.abort(), transport: async () => { throw new Error(); } });
  await assert.rejects(client('/api/v1/test'), { message: 'CANCELLED', exitCode: 4 });
});
test('oversized server output is bounded', async () => {
  const client = remoteClient({ origin: 'https://example.com', token: 'x'.repeat(32), transport: async () => new Response('x'.repeat(262145)) });
  await assert.rejects(client('/api/v1/test'), { message: 'RESPONSE_LIMIT', exitCode: 4 });
});

test('release JSON includes only validated aggregate coverage and finding counts', () => {
 const result = releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, decision: 'BLOCK', coverage: { required: 2, passed: 1, failed: 1, incomplete: 0, source: 'secret' }, findings: { reproducibleFailures: 1, payload: 'secret' } }, identity);
 assert.deepEqual(result.output.coverage, { required: 2, passed: 1, failed: 1, incomplete: 0 });
 assert.deepEqual(result.output.findings, { reproducibleFailures: 1 });
 assert.ok(!JSON.stringify(result.output).includes('secret'));
 assert.equal(releaseResult({ schemaVersion: 1, type: 'RELEASE_CHECK', ...identity, decision: 'BLOCK', coverage: { required: -1 } }, identity).output.coverage, null);
});
