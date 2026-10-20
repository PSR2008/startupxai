'use client';
import { useEffect, useState } from 'react';
import { api, errorCopy } from './client';
import { useData, type Row, str } from './data';
import { Alert, Field, Panel } from './ui';
export function GitHubOnboarding({ projectId }: { projectId: string }) {
  const installation = useData<Row>(`projects/${projectId}/github/onboarding`, {}), connections = useData<Row[]>(`projects/${projectId}/github/connections`, []), checks = useData<Row[]>(`projects/${projectId}/views/checks`, []), writes = useData<Row[]>(`projects/${projectId}/views/write-permissions`, []);
  const [catalog, setCatalog] = useState<Row[]>([]), [error, setError] = useState(''), [root, setRoot] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem('launchgate-github-catalog') ?? 'null'); if (saved?.projectId === projectId && saved.expires > Date.now() && Array.isArray(saved.repositories)) setCatalog(saved.repositories.slice(0, 100)); } catch { /* Discard invalid local display data. */ } }, [projectId]);
  async function authorize(repo?: Row) {
    setBusy(true);
    try {
      const result = await api<Row>(`projects/${projectId}/github/setup`, { installationId: repo?.installationId ?? 1, repositoryId: repo?.repositoryId ?? 1, applicationRoot: repo ? root : '' });
      const url = new URL(str(result, 'authorizationUrl'));
      if (url.origin !== 'https://github.com' || url.pathname !== '/login/oauth/authorize') throw new Error();
      sessionStorage.setItem('launchgate-github-setup', JSON.stringify({ projectId, state: result.state, expires: Date.now() + 600000, mode: repo ? 'connect' : 'catalog' })); location.assign(url.href);
    } catch (e) { setError(errorCopy(e)); setBusy(false); }
  }
  const installed = connections.data.some(c => c.status === 'ACTIVE'), published = checks.data.some(c => c.publication_state === 'PUBLISHED');
  return <Panel title="Install and select a GitHub repository"><p>Install the analysis App on selected repositories, then authorize repository discovery. Selecting a repository starts a fresh authorization that verifies your administration access before connecting it.</p>{Boolean(installation.data.installUrl) && <a className="lg-button" href={str(installation.data, 'installUrl')} target="_blank" rel="noreferrer">Install GitHub App</a>}<button className="lg-button" disabled={busy} onClick={() => void authorize()}>Select repositories from GitHub</button><Field label="Application root (optional)"><input value={root} onChange={e => setRoot(e.target.value)} maxLength={240} /></Field>{catalog.map(r => <div key={`${r.installationId}:${r.repositoryId}`} className="lg-panel-body"><strong>{str(r, 'name')}</strong><p>{str(r, 'visibility')} · Checks permission: {str(r, 'checksPermission')}</p><button className="lg-button" disabled={busy} onClick={() => void authorize(r)}>Connect {str(r, 'name')}</button></div>)}<dl><dt>Analysis access</dt><dd>{installed ? 'Installation previously verified; rechecked on ingestion' : 'Not established'}</dd><dt>Repository access</dt><dd>{installed ? 'Selected repository bound' : 'Select and authorize a repository'}</dd><dt>Webhook health</dt><dd>{published ? 'Release delivery and check publication observed' : 'No end-to-end delivery observed'}</dd><dt>Checks permission</dt><dd>{published ? 'Successful publication recorded' : 'Not yet proven by publication'}</dd><dt>Remediation write capability</dt><dd>{writes.data.some(w => w.enabled && !w.revoked_at && Date.parse(str(w, 'expires_at')) > Date.now()) ? 'Separately authorized' : 'Not enabled — optional'}</dd></dl>{(error || installation.error) && <Alert error>{error || installation.error}</Alert>}</Panel>;
}
