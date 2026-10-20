import { readFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { remoteClient, releaseResult, serverOrigin, CliError } from '../../../packages/cli/src/remote.mjs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sha = /^[a-f0-9]{40}$/;
const escapeCommand = value => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
export async function checkAction(env, event, { transport = fetch, log = console.log, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), signal = new AbortController().signal } = {}) {
  const token = env.INPUT_TOKEN || '';
  if (token) log(`::add-mask::${escapeCommand(token)}`);
  try {
    if (!/^lgci_[a-f0-9]{64}$/.test(token)) throw new CliError('CI_AUTHENTICATION_REQUIRED', 3);
    if (!uuid.test(env.INPUT_PROJECT || '') || !/^(?:[1-9][0-9]{0,2})$/.test(env.INPUT_TIMEOUT || '300') || Number(env.INPUT_TIMEOUT || 300) > 900 || !['true', 'false'].includes(env.INPUT_WAIT || 'true')) throw new CliError('INVALID_ACTION_INPUT', 3);
    const origin = serverOrigin(env.INPUT_SERVER);
    if (!origin.startsWith('https://') || origin !== serverOrigin(env.LAUNCHGATE_TRUSTED_ORIGIN)) throw new CliError('UNTRUSTED_SERVER', 3);
    const workflowSha = env.GITHUB_SHA, commitSha = event.pull_request?.head?.sha ?? workflowSha, baseSha = event.pull_request?.base?.sha ?? null;
    if (!sha.test(workflowSha || '') || !sha.test(commitSha || '') || baseSha !== null && !sha.test(baseSha)) throw new CliError('INVALID_COMMIT_IDENTITY', 3);
    const request = remoteClient({ origin, token, transport, signal }), started = now(), timeout = Number(env.INPUT_TIMEOUT || 300) * 1000;
    let result;
    do {
      if (signal?.aborted) throw new CliError('CANCELLED', 4);
      const value = await request('/api/v1/distribution/machine/reconcile', { projectId: env.INPUT_PROJECT, commitSha, baseSha });
      if (value.type === 'RELEASE_CHECK') {
        if (!uuid.test(value.releaseId) || baseSha !== null && value.baseSha !== baseSha) throw new CliError('RELEASE_IDENTITY_MISMATCH', 4);
        result = releaseResult(value, { projectId: env.INPUT_PROJECT, releaseId: value.releaseId, commitSha, now: now() });
        if (result.exitCode !== 2) break;
      } else if (value.type !== 'RELEASE_PENDING' || value.projectId !== env.INPUT_PROJECT || value.decision !== 'INCONCLUSIVE') throw new CliError('INVALID_RESPONSE', 4);
      if (env.INPUT_WAIT === 'false' || now() - started >= timeout) break;
      await sleep(Math.min(2000, Math.max(0, timeout - (now() - started))));
    } while (now() - started < timeout);
    result ??= { exitCode: 2, output: { schemaVersion: 1, type: 'RELEASE_CHECK', projectId: env.INPUT_PROJECT, commitSha, decision: 'INCONCLUSIVE' } };
    const summary = `### LaunchGate release gate\n\n**${result.output.decision}**\n\nCommit: \`${commitSha}\`\n\nWorkflow SHA: \`${workflowSha}\`\n\n${baseSha ? `PR base: \`${baseSha}\`\n\n` : ''}The result describes the configured release policy and tested scope. Static inspection does not prove runtime invariants.\n`;
    log(`LaunchGate: ${result.output.decision}`);
    return { ...result, summary };
  } catch (error) {
    const code = error instanceof CliError ? error.message : 'ACTION_FAILED'; log(`LaunchGate: ${code}`);
    return { exitCode: error instanceof CliError ? error.exitCode : 4, output: { schemaVersion: 1, type: 'ERROR', code }, summary: `### LaunchGate release gate\n\nAssurance unavailable: ${code}. Merge gating did not pass.\n` };
  }
}
async function actionMain() {
  const controller = new AbortController(); process.once('SIGTERM', () => controller.abort()); process.once('SIGINT', () => controller.abort());
  let event = {};
  try { if (process.env.GITHUB_EVENT_PATH) { const text = await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'); if (text.length > 1048576) throw new Error(); event = JSON.parse(text); } }
  catch { console.error('LaunchGate: invalid event metadata'); process.exitCode = 3; }
  if (!process.exitCode) {
    const result = await checkAction(process.env, event, { signal: controller.signal });
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result.summary);
    if (process.env.GITHUB_OUTPUT && result.output.decision) await appendFile(process.env.GITHUB_OUTPUT, `decision=${result.output.decision}\nrelease=${result.output.releaseId || ''}\n`);
    process.exitCode = result.exitCode;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void actionMain().catch(() => { console.error('LaunchGate: ACTION_FAILED'); process.exitCode = 4; });
