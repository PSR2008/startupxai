import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialize, readConfig, validateConfig } from '../src/config.mjs';
test('config schema rejects credentials, executable config and unsupported versions', () => {
  for (const config of [{ schemaVersion: 2 }, { schemaVersion: 1, token: 'secret' }, { schemaVersion: 1, apiUrl: 'https://evil.test' }, { schemaVersion: 1, projectId: '$(attack)' }, { schemaVersion: 1, selectedInvariants: ['../x'] }]) assert.throws(() => validateConfig(config), /INVALID_CONFIG/);
});
test('init detects GitHub origin without invoking git and never overwrites existing config', async t => {
  const root = await mkdtemp(join(tmpdir(), 'launchgate-phase12-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.git'));
  await writeFile(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:example/product.git\n[core]\n hooksPath = malicious\n');
  const result = await initialize(root);
  assert.equal(result.gitDetected, true);
  assert.equal(result.config.repositoryIdentity, 'example/product');
  assert.deepEqual(await readConfig(root), result.config);
  const before = await readFile(join(root, 'launchgate.config.json'), 'utf8');
  await assert.rejects(initialize(root));
  assert.equal(await readFile(join(root, 'launchgate.config.json'), 'utf8'), before);
});
