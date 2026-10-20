import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, win32, posix } from 'node:path';
import { inspect, within, disclaimer } from '../src/static.mjs';
import { run } from '../src/main.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'launchgate-phase12-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('offline syntax inspection detects stack and recommendations without executing scripts', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '15', stripe: '1' }, scripts: { postinstall: 'throw new Error("NEVER EXECUTE")' } }));
  await writeFile(join(root, 'handler.ts'), 'requireProjectAccess(user, project); stripe.webhooks.constructEvent(body); throw new Error("NEVER EXECUTE");');
  const result = await inspect(root);
  assert.equal(result.type, 'STATIC_ASSESSMENT');
  assert.equal(result.disclaimer, disclaimer);
  assert.equal(result.stack.find(s => s.name === 'Next.js').status, 'DETECTED');
  assert.ok(result.recommendations.some(r => r.domain === 'tenant_isolation'));
  assert.ok(result.recommendations.every(r => r.confirmationRequired));
  assert.equal(result.decision, undefined);
  assert.ok(!JSON.stringify(result).includes('NEVER EXECUTE'));
});
test('JSON is a single versioned document without ANSI or source content', async t => {
  const root = await fixture(t), lines = [];
  await writeFile(join(root, 'source.ts'), 'const secret = "sensitive-body";');
  assert.equal(await run(['inspect', '--json'], { cwd: root, out: value => lines.push(value) }), 0);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).schemaVersion, 1);
  assert.ok(!lines[0].includes('\x1b'));
  assert.ok(!lines[0].includes('sensitive-body'));
});
test('credentials and binary content are excluded', async t => {
  const root = await fixture(t);
  await writeFile(join(root, '.env'), 'PASSWORD=never-return');
  await writeFile(join(root, 'private.key'), 'never-return');
  await writeFile(join(root, 'image.bin'), Buffer.from([0, 1, 2]));
  const result = await inspect(root);
  assert.equal(result.coverage.status, 'PARTIAL');
  assert.equal(result.coverage.exclusions.BINARY, 1);
  assert.ok(!JSON.stringify(result).includes('never-return'));
});
test('oversized files and generated trees are never loaded', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'node_modules', 'bad.js'), 'requireProjectAccess()');
  await writeFile(join(root, 'large.ts'), 'x'.repeat(65537));
  const result = await inspect(root);
  assert.equal(result.coverage.bytes, 0);
  assert.equal(result.coverage.exclusions.BYTE_LIMIT, 1);
  assert.deepEqual(result.recommendations, []);
});
test('directory symlinks/junctions cannot escape repository', async t => {
  const root = await fixture(t), outside = await fixture(t);
  await writeFile(join(outside, 'secret.ts'), 'requireProjectAccess()');
  await symlink(outside, join(root, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await inspect(root);
  assert.equal(result.coverage.exclusions.SYMLINK_OR_SUBMODULE, 1);
  assert.deepEqual(result.recommendations, []);
});
test('path containment rejects parent, sibling-prefix and root itself', () => {
  const root = resolve('fixture');
  assert.equal(within(root, root), false);
  assert.equal(within(root, resolve('fixture-other', 'secret')), false);
  assert.equal(within(root, resolve('fixture', '..', 'secret')), false);
  assert.equal(within(root, resolve('fixture', 'nested', 'file')), true);
});
test('Windows drive, UNC and POSIX containment use platform path semantics', () => {
  assert.equal(within('C:\\repo', 'C:\\repo\\src\\a.ts', win32), true);
  assert.equal(within('C:\\repo', 'D:\\repo\\secret', win32), false);
  assert.equal(within('C:\\repo', 'C:\\repository\\secret', win32), false);
  assert.equal(within('\\\\server\\share\\repo', '\\\\server\\other\\secret', win32), false);
  assert.equal(within('/repo', '/repo/src/a.ts', posix), true);
  assert.equal(within('/repo', '/repo/../secret', posix), false);
});
test('ambiguous check is unsupported and does not return success', async () => {
  assert.equal(await run(['check'], { out() {} }), 5);
  assert.equal(await run(['inspect', '--token=secret'], { out() {} }), 3);
});
test('quiet suppresses human output while JSON remains machine-readable', async () => {
  const lines = [];
  assert.equal(await run(['version', '--quiet'], { out: v => lines.push(v) }), 0);
  assert.equal(lines.length, 0);
  assert.equal(await run(['version', '--quiet', '--json'], { out: v => lines.push(v) }), 0);
  assert.equal(JSON.parse(lines[0]).type, 'VERSION');
});
