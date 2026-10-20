export class CliError extends Error {
  constructor(code, exitCode) { super(code); this.exitCode = exitCode; }
}
export function serverOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new CliError('SERVER_NOT_CONFIGURED', 3); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new CliError('INVALID_SERVER', 3);
  return url.origin;
}
export function remoteClient({ origin, token, transport = fetch, signal = new AbortController().signal }) {
  const base = serverOrigin(origin);
  if (typeof token !== 'string' || !/^[A-Za-z0-9._~-]{20,4096}$/.test(token)) throw new CliError('AUTHENTICATION_REQUIRED', 3);
  return async (path, body) => {
    if (!/^\/api\/v1\/[A-Za-z0-9/_-]+$/.test(path)) throw new CliError('INVALID_REQUEST', 3);
    let response;
    try { response = await transport(base + path, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'X-LaunchGate-Protocol': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } }); }
    catch { throw new CliError(signal?.aborted ? 'CANCELLED' : 'SERVER_UNAVAILABLE', 4); }
    if (!response.ok) { await response.body?.cancel(); throw new CliError([401, 403].includes(response.status) ? 'ACCESS_DENIED' : 'SERVER_ERROR', [401, 403].includes(response.status) ? 3 : 4); }
    if (!response.body) throw new CliError('INVALID_RESPONSE', 4);
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length; if (size > 262144) { await reader.cancel(); throw new CliError('RESPONSE_LIMIT', 4); }
        chunks.push(value);
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (result.schemaVersion !== 1) throw new CliError('INCOMPATIBLE_PROTOCOL', 5);
      return result;
    } catch (error) { throw error instanceof CliError ? error : new CliError('INVALID_RESPONSE', 4); }
    finally { reader.releaseLock(); }
  };
}
/** Fail closed on stale, mismatched or incomplete authoritative release responses. */
export function releaseResult(value, { projectId, releaseId, commitSha, now = Date.now() }) {
  if (value.schemaVersion !== 1 || value.type !== 'RELEASE_CHECK' || value.projectId !== projectId || value.releaseId !== releaseId || !/^[a-f0-9]{40}$/.test(value.commitSha) || commitSha && value.commitSha !== commitSha || !['SHIP', 'BLOCK', 'INCONCLUSIVE'].includes(value.decision)) throw new CliError('RELEASE_IDENTITY_MISMATCH', 4);
  const validUntil = typeof value.validUntil === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value.validUntil) && Number.isFinite(Date.parse(value.validUntil)) ? value.validUntil : null;
  const fresh = value.decision !== 'SHIP' || validUntil !== null && Date.parse(validUntil) > now;
  const decision = fresh ? value.decision : 'INCONCLUSIVE';
  const counts = (input, keys) => input && keys.every(key => Number.isSafeInteger(input[key]) && input[key] >= 0) ? Object.fromEntries(keys.map(key => [key, input[key]])) : null;
  return {
    output: { schemaVersion: 1, type: 'RELEASE_CHECK', projectId, releaseId, commitSha: value.commitSha, decision, coverage: counts(value.coverage, ['required', 'passed', 'failed', 'incomplete']), findings: counts(value.findings, ['reproducibleFailures']), validUntil: decision === 'SHIP' ? validUntil : null },
    exitCode: { SHIP: 0, BLOCK: 1, INCONCLUSIVE: 2 }[decision],
  };
}
