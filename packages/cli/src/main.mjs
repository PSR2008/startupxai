#!/usr/bin/env node
import { inspect } from './static.mjs';
import { initialize, readConfig } from './config.mjs';
import { CliError, remoteClient, releaseResult, serverOrigin } from './remote.mjs';
import { fileCredentialStore, browserExchange, humanLogin } from './auth.mjs';
export async function run(args, { cwd = process.cwd(), out = console.log, env = process.env, transport = fetch, store = fileCredentialStore(), exchange = browserExchange, err = console.error } = {}) {
  const [command, ...flags] = args;
  const json = flags.includes('--json'), quiet = flags.includes('--quiet');
  const emit = value => { if (json) out(JSON.stringify(value)); else if (!quiet) out(value.disclaimer ? `LaunchGate Static Assessment\n\n${value.disclaimer}\n\nStack\n${value.stack.filter(s => s.status !== 'NOT_DETECTED').map(s => `${s.name}: ${s.status}`).join('\n')}\n\nRecommended invariants\n${value.recommendations.map(r => r.domain).join('\n')}\n\nCoverage: ${value.coverage.status}\nNext: ${value.next}` : JSON.stringify(value)); };
  try {
    const options = {};
    for (let i = 0; i < flags.length; i++) {
      const flag = flags[i];
      if (['--json', '--quiet', '--local'].includes(flag) || command === 'check' && flag === '--wait') continue;
      if (command === 'init' && ['--project', '--organization'].includes(flag) && flags[i + 1] && !options[flag]) { options[flag] = flags[++i]; continue; }
      if (command === 'check' && ['--release', '--sha', '--timeout'].includes(flag) && flags[i + 1] && !options[flag]) { options[flag] = flags[++i]; continue; }
      throw new Error('INVALID_ARGUMENT');
    }
    if (command === 'version') { emit({ schemaVersion: 1, type: 'VERSION', version: '0.1.0', protocolVersion: 1 }); return 0; }
    const tokenFor = async () => {
      if (env.LAUNCHGATE_TOKEN) { if (!/^lgci_[a-f0-9]{64}$/.test(env.LAUNCHGATE_TOKEN)) throw new CliError('SCOPED_CI_TOKEN_REQUIRED', 3); return env.LAUNCHGATE_TOKEN; }
      if (env.CI) throw new CliError('CI_AUTHENTICATION_REQUIRED', 3);
      return await store.get(serverOrigin(env.LAUNCHGATE_URL));
    };
    if (command === 'login') {
      if (env.CI || env.LAUNCHGATE_TOKEN) throw new CliError('INTERACTIVE_LOGIN_REQUIRED', 3);
      if (store.warning) err(store.warning);
      emit(await humanLogin({ origin: env.LAUNCHGATE_URL, store, exchange, announce: url => err(`Authorize this CLI in your browser: ${url}`), transport })); return 0;
    }
    if (['logout', 'whoami'].includes(command)) {
      const origin = serverOrigin(env.LAUNCHGATE_URL), token = await tokenFor();
      if (env.LAUNCHGATE_TOKEN || !token?.startsWith('lghu_')) throw new CliError('HUMAN_SESSION_REQUIRED', 3);
      try { emit(await remoteClient({ origin, token, transport })(`/api/v1/distribution/machine/${command}`, {})); }
      finally { if (command === 'logout') await store.delete(origin); }
      return 0;
    }
    if (command === 'init') {
      const assessment = await inspect(cwd);
      const initialized = await initialize(cwd, { ...(options['--project'] ? { projectId: options['--project'] } : {}), ...(options['--organization'] ? { organizationId: options['--organization'] } : {}) });
      emit({ ...initialized, assessment }); return 0;
    }
    if (command === 'open') {
      const config = await readConfig(cwd);
      if (!config.projectId) throw new CliError('PROJECT_NOT_CONFIGURED', 3);
      emit({ schemaVersion: 1, type: 'PROJECT_URL', url: `${serverOrigin(env.LAUNCHGATE_URL)}/app/projects/${config.projectId}` }); return 0;
    }
    if (command === 'check' && options['--release']) {
      if (flags.includes('--local')) throw new CliError('AMBIGUOUS_CHECK_MODE', 3);
      if (!/^[a-f0-9-]{36}$/i.test(options['--release']) || options['--sha'] && !/^[a-f0-9]{40}$/.test(options['--sha'])) throw new CliError('INVALID_ARGUMENT', 3);
      const config = await readConfig(cwd);
      if (!config.projectId) throw new CliError('PROJECT_NOT_CONFIGURED', 3);
      const token = await tokenFor();
      const client = remoteClient({ origin: env.LAUNCHGATE_URL, token, transport });
      const timeout = Number(options['--timeout'] || 300);
      if (!Number.isInteger(timeout) || timeout < 1 || timeout > 900 || options['--timeout'] && !/^[0-9]{1,3}$/.test(options['--timeout'])) throw new CliError('INVALID_TIMEOUT', 3);
      const deadline = Date.now() + timeout * 1000;
      do {
        const value = await client('/api/v1/distribution/machine/check', { projectId: config.projectId, releaseId: options['--release'] });
        const result = value.type === 'RELEASE_PENDING' ? { output: { schemaVersion: 1, type: 'RELEASE_CHECK', projectId: config.projectId, releaseId: options['--release'], decision: 'INCONCLUSIVE' }, exitCode: 2 } : releaseResult(value, { projectId: config.projectId, releaseId: options['--release'], commitSha: options['--sha'] });
        if (!flags.includes('--wait') || result.exitCode !== 2 || Date.now() >= deadline) { emit(result.output); return result.exitCode; }
        await new Promise(resolve => setTimeout(resolve, Math.min(2000, Math.max(1, deadline - Date.now()))));
      } while (true);
    }
    if (['releases', 'findings', 'status'].includes(command)) {
      const config = await readConfig(cwd); if (!config.projectId) throw new CliError('PROJECT_NOT_CONFIGURED', 3);
      const client = remoteClient({ origin: env.LAUNCHGATE_URL, token: await tokenFor(), transport });
      emit(await client(`/api/v1/distribution/machine/${command === 'status' ? 'releases' : command}`, { projectId: config.projectId })); return 0;
    }
    if (['inspect', 'preflight'].includes(command) || command === 'check' && flags.includes('--local')) {
      const assessment = await inspect(cwd);
      if (command === 'preflight') {
        let config;
        try { config = await readConfig(cwd); } catch { /* No remote work occurs during offline preflight. */ }
        assessment.configuration = { projectLinked: Boolean(config?.projectId), remoteVerification: 'NOT_CHECKED', unresolvedRegressions: 'NOT_CHECKED' };
      }
      emit(assessment); return 0;
    }
    emit({ schemaVersion: 1, type: 'ERROR', code: 'UNSUPPORTED_OPERATION' }); return 5;
  } catch (error) {
    if (error instanceof CliError) { emit({ schemaVersion: 1, type: 'ERROR', code: error.message }); return error.exitCode; }
    const safe = ['TREE_LIMIT', 'UNSAFE_PATH', 'SOURCE_CHANGED', 'STATIC_ANALYSIS_FAILED', 'INVALID_ARGUMENT'].includes(error.message) ? error.message : 'LOCAL_INSPECTION_FAILED';
    emit({ schemaVersion: 1, type: 'ERROR', code: safe }); return 3;
  } finally {
    // Offline operations remain offline unless the user explicitly opts in.
    if (env.LAUNCHGATE_TELEMETRY === '1' && ['init', 'inspect'].includes(command)) {
      try { await transport(`${serverOrigin(env.LAUNCHGATE_URL)}/api/public/telemetry`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(1000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: `cli_${command}` }) }); } catch { /* Aggregate telemetry cannot affect command results. */ }
    }
  }
}
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await run(process.argv.slice(2));
