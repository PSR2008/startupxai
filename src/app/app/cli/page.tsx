'use client';
import { useEffect, useState } from 'react';
import { api } from '@/components/launchgate/client';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
export default function CliAuthorization() {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (location.search.length <= 1024 && new URLSearchParams(location.search).has('callback')) sessionStorage.setItem('launchgate-cli-login', JSON.stringify({ query: location.search, expires: Date.now() + 300000 }));
    void getSupabaseBrowserClient().auth.getSession().then(({ data }) => { if (!data.session) location.assign('/app/login?cli=1'); }).catch(() => setMessage('Authentication is not configured.'));
  }, []);
  async function approve() {
    setBusy(true);
    let id: string | undefined;
    try {
      const saved = JSON.parse(sessionStorage.getItem('launchgate-cli-login') ?? 'null');
      if (!saved || saved.expires <= Date.now()) throw new Error();
      const params = new URLSearchParams(saved.query), callback = new URL(params.get('callback') ?? ''), state = params.get('state');
      if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' || !callback.port || callback.pathname !== '/callback' || callback.search || callback.hash || callback.username || callback.password || !/^[a-f0-9]{64}$/.test(state ?? '')) throw new Error();
      const result = await api<{ id: string; token: string }>('cli-sessions', { action: 'create' }); id = result.id;
      const response = await fetch(callback.href, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, token: result.token }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      sessionStorage.removeItem('launchgate-cli-login'); history.replaceState(null, '', '/app/cli'); setMessage('CLI authorized for one day. You may close this page.');
    } catch {
      if (id) await api('cli-sessions', { action: 'revoke', id }).catch(() => {});
      setMessage('Authorization failed. Sign in, then restart launchgate login from your terminal.');
    } finally { setBusy(false); }
  }
  return <main className="lg-panel-body"><h1>Authorize LaunchGate CLI</h1><p>Only approve a login you started on this computer. This gives your CLI a one-day human session for project history and release checks. It does not grant organization administration or remediation permissions.</p><button className="lg-button" disabled={busy || Boolean(message)} onClick={() => void approve()}>Authorize this CLI</button><p role="status">{message}</p></main>;
}
