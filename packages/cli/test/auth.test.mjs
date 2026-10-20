import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/main.mjs';
import { browserExchange } from '../src/auth.mjs';
const origin = 'https://launchgate.example', token = 'lghu_' + 'a'.repeat(64);
function fixture() {
  let saved = null;
  return { store: { async get() { return saved; }, async set(_origin, value) { saved = value; }, async delete() { saved = null; } }, get saved() { return saved; } };
}
test('browser exchange verifies human identity before storing credentials', async () => {
  const f = fixture(), lines = [];
  const transport = async (_url, options) => { assert.equal(options.headers.Authorization, `Bearer ${token}`); return Response.json({ schemaVersion: 1, type: 'HUMAN_SESSION', userId: '11111111-1111-4111-8111-111111111111', expiresAt: new Date(Date.now()+3600000).toISOString() }); };
  assert.equal(await run(['login', '--json'], { env: { LAUNCHGATE_URL: origin }, store: f.store, exchange: async () => token, transport, out: v => lines.push(v) }), 0);
  assert.equal(f.saved, token); assert.ok(!JSON.stringify(lines).includes(token));
  assert.equal(await run(['whoami', '--json'], { env: { LAUNCHGATE_URL: origin }, store: f.store, transport, out() {} }), 0);
});
test('logout deletes local credentials even when server revocation cannot be reached', async () => {
  const f = fixture(); await f.store.set(origin, token);
  assert.equal(await run(['logout'], { env: { LAUNCHGATE_URL: origin }, store: f.store, transport: async () => { throw new Error(); }, out() {} }), 4);
  assert.equal(f.saved, null);
});
test('CI cannot use interactive login and expired auth never persists', async () => {
  const f = fixture();
  assert.equal(await run(['login'], { env: { CI: 'true', LAUNCHGATE_URL: origin }, store: f.store, out() {} }), 3);
  assert.equal(await run(['login'], { env: { LAUNCHGATE_URL: origin }, store: f.store, exchange: async () => token, transport: async () => Response.json({ schemaVersion: 1, type: 'HUMAN_SESSION', expiresAt: '2000-01-01T00:00:00Z' }), out() {} }), 3);
  assert.equal(f.saved, null);
});
test('loopback login rejects foreign Origin and incorrect state before accepting the bound browser', async () => {
  const exchanged = await browserExchange(origin, url => {
    void (async () => {
      const params = new URL(url).searchParams, callback = params.get('callback'), state = params.get('state');
      const request = (requestOrigin, requestState) => fetch(callback, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: requestState, token }) });
      assert.equal((await request('https://attacker.invalid', state)).status, 403);
      assert.equal((await request(origin, '0'.repeat(64))).status, 400);
      assert.equal((await request(origin, state)).status, 200);
    })();
  }, () => {});
  assert.equal(exchanged, token);
});
