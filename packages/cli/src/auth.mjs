import { mkdir, lstat, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { boundedFile } from './config.mjs';
import { CliError, remoteClient, serverOrigin } from './remote.mjs';

/** Injectable interface: get(origin), set(origin, token), delete(origin).
 * Default fallback is user-only storage outside repositories, never config. */
export function fileCredentialStore() {
  const directory = join(homedir(), '.launchgate-credentials');
  const path = origin => join(directory, createHash('sha256').update(serverOrigin(origin)).digest('hex') + '.json');
  const assertWindowsAcl = (target, sid, system) => {
    const command = "$a=Get-Acl -LiteralPath $env:LG_CREDENTIAL_DIR; @($a.Access | Where-Object {$_.AccessControlType -eq 'Allow'} | ForEach-Object {$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value}) | ConvertTo-Json -Compress";
    const acl = JSON.parse(execFileSync(join(system, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, env: { ...process.env, LG_CREDENTIAL_DIR: target } }).trim());
    if ((Array.isArray(acl) ? acl : [acl]).some(value => value !== sid)) throw new CliError('UNSAFE_CREDENTIAL_STORE', 3);
  };
  const secure = async () => {
    await mkdir(directory, { mode: 0o700, recursive: true });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CliError('UNSAFE_CREDENTIAL_STORE', 3);
    if (process.platform === 'win32') {
      const system = join(process.env.SystemRoot || 'C:\\Windows', 'System32');
      const sid = execFileSync(join(system, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-5-[0-9-]+/)?.[0];
      if (!sid) throw new CliError('UNSAFE_CREDENTIAL_STORE', 3);
      execFileSync(join(system, 'icacls.exe'), [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { stdio: 'ignore', windowsHide: true });
      // Refuse any pre-existing explicit grant to another identity. Inheritance
      // removal alone would not remove an unsafe explicit ACL on an old directory.
      assertWindowsAcl(directory, sid, system);
      return { sid, system };
    } else if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new CliError('UNSAFE_CREDENTIAL_STORE', 3);
  };
  return {
    warning: 'OS keychain unavailable: using a local user-only credential file. Logout removes it.',
    async get(origin) {
      try {
        const windowsIdentity = await secure(); const file = path(origin), stat = await lstat(file);
        if (windowsIdentity) assertWindowsAcl(file, windowsIdentity.sid, windowsIdentity.system);
        if (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)) throw new CliError('UNSAFE_CREDENTIAL_STORE', 3);
        const value = JSON.parse(await boundedFile(file));
        if (value.origin !== serverOrigin(origin) || !/^lghu_[a-f0-9]{64}$/.test(value.token)) throw new CliError('INVALID_CREDENTIAL_STORE', 3);
        return value.token;
      } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async set(origin, token) {
      if (!/^lghu_[a-f0-9]{64}$/.test(token)) throw new CliError('INVALID_HUMAN_TOKEN', 3);
      await secure(); await this.delete(origin);
      await writeFile(path(origin), JSON.stringify({ origin: serverOrigin(origin), token }), { flag: 'wx', mode: 0o600 });
    },
    async delete(origin) { try { await unlink(path(origin)); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
  };
}
export function openBrowser(url) {
  const command = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'rundll32.exe') : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url], { shell: false, windowsHide: true, stdio: 'ignore' });
  child.on('error', () => {}); child.unref();
}
export async function browserExchange(origin, announce, launch = openBrowser) {
  const base = serverOrigin(origin), state = randomBytes(32).toString('hex');
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      const headers = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' };
      if (request.headers.origin !== base || request.url !== '/callback') { response.writeHead(403).end(); return; }
      if (request.method === 'OPTIONS') { response.writeHead(204, headers).end(); return; }
      if (request.method !== 'POST') { response.writeHead(405, headers).end(); return; }
      try {
        let text = ''; for await (const chunk of request) { text += chunk.toString('utf8'); if (text.length > 4096) throw new Error(); }
        const body = JSON.parse(text);
        if (!/^[a-f0-9]{64}$/.test(body.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(body.state)) || !/^lghu_[a-f0-9]{64}$/.test(body.token)) throw new Error();
        response.writeHead(200, headers).end('{}'); clearTimeout(timer); server.close(); resolve(body.token);
      } catch { response.writeHead(400, headers).end(); }
    });
    const timer = setTimeout(() => { server.closeAllConnections(); server.close(); reject(new CliError('LOGIN_TIMEOUT', 3)); }, 300000);
    server.headersTimeout = 10000; server.requestTimeout = 10000;
    server.once('error', () => { clearTimeout(timer); reject(new CliError('LOGIN_UNAVAILABLE', 3)); });
    server.listen(0, '127.0.0.1', () => {
      const url = `${base}/app/cli?callback=${encodeURIComponent(`http://127.0.0.1:${server.address().port}/callback`)}&state=${state}`;
      announce(url); launch(url);
    });
  });
}
export async function humanLogin({ origin, store, exchange, announce, transport }) {
  const token = await exchange(origin, announce);
  const identity = await remoteClient({ origin, token, transport })('/api/v1/distribution/machine/whoami', {});
  const expires = Date.parse(identity.expiresAt);
  if (identity.type !== 'HUMAN_SESSION' || !/^[a-f0-9-]{36}$/i.test(identity.userId || '') || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 86460000) throw new CliError('INVALID_HUMAN_SESSION', 3);
  await store.set(origin, token); return { schemaVersion: 1, type: 'HUMAN_SESSION', userId: identity.userId, expiresAt: identity.expiresAt };
}
