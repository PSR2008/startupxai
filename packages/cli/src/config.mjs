import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
export const configName = 'launchgate.config.json';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateConfig(value) {
  const allowed = ['schemaVersion', 'organizationId', 'projectId', 'repositoryIdentity', 'defaultEnvironment', 'policyId', 'selectedInvariants'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 || Object.keys(value).some(k => !allowed.includes(k))) throw new Error('INVALID_CONFIG');
  for (const key of ['organizationId', 'projectId', 'policyId']) if (value[key] !== undefined && !uuid.test(value[key])) throw new Error('INVALID_CONFIG');
  if (value.defaultEnvironment !== undefined && !['PREVIEW', 'STAGING', 'SANDBOX'].includes(value.defaultEnvironment)) throw new Error('INVALID_CONFIG');
  if (value.repositoryIdentity !== undefined && !/^[A-Za-z0-9_-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(value.repositoryIdentity)) throw new Error('INVALID_CONFIG');
  if (value.selectedInvariants !== undefined && (!Array.isArray(value.selectedInvariants) || value.selectedInvariants.length > 100 || value.selectedInvariants.some(v => typeof v !== 'string' || !uuid.test(v)))) throw new Error('INVALID_CONFIG');
  return value;
}
export async function boundedFile(path, max = 16384) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > max) throw new Error('INVALID_CONFIG');
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev) throw new Error('INVALID_CONFIG');
    const buffer = Buffer.alloc(max + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = await file.read(buffer, count, buffer.length - count, count);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    if (count > max) throw new Error('INVALID_CONFIG');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, count));
  } finally { await file.close(); }
}
export async function readConfig(cwd) { return validateConfig(JSON.parse(await boundedFile(join(cwd, configName)))); }
export async function initialize(cwd, fields = {}) {
  let gitDetected = false, repositoryIdentity;
  try {
    const stat = await lstat(join(cwd, '.git'));
    gitDetected = stat.isDirectory() && !stat.isSymbolicLink();
    if (gitDetected) {
      const config = await boundedFile(join(cwd, '.git', 'config'));
      const section = /^\[remote "origin"\]\s*\r?\n([\s\S]*?)(?=^\[|$)/m.exec(config)?.[1];
      const remote = /^\s*url\s*=\s*(\S+)\s*$/m.exec(section || '')?.[1];
      const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_-]{1,39}\/[A-Za-z0-9_.-]{1,100})$/.exec(remote || '');
      if (match) repositoryIdentity = match[1].replace(/\.git$/, '');
    }
  } catch { /* Detection is optional and never follows gitdir/include directives. */ }
  const config = validateConfig({ schemaVersion: 1, ...(repositoryIdentity ? { repositoryIdentity } : {}), defaultEnvironment: 'PREVIEW', ...fields });
  const file = await open(join(cwd, configName), 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(config, null, 2) + '\n'); } finally { await file.close(); }
  return { schemaVersion: 1, type: 'INITIALIZED', config, gitDetected, next: 'Connect an existing project with --project and --organization, or create one in the LaunchGate app.' };
}
