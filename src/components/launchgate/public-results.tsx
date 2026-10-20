'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
type Result = { disclaimer?: string; displayName?: string; purpose?: string; decision?: string; state?: string; freshness?: string; commit?: string; repository?: string; commitSha?: string; evaluatedAt?: string; policyVersion?: number; engineVersion?: string; explanation?: string; coverage?: Record<string, unknown>; stack?: { name: string; status: string }[]; recommendations?: { domain: string; statement: string }[] };
export function PublicAssessment() {
  const [repository, setRepository] = useState(''), [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function assess(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/public/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repository }), signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(response.status === 429 ? 'Assessment capacity is limited. Please try again later.' : 'This public repository could not be assessed within the supported limits.');
      setResult(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Assessment unavailable.'); } finally { setBusy(false); }
  }
  return <main className="lg lg-panel-body lg-public-result" style={{ maxWidth: 900, margin: 'auto' }}><Link href="/">LaunchGate</Link><h1>What should your app prove?</h1><p>Static analysis only. Runtime business invariants have not yet been proven.</p><form onSubmit={assess}><label className="lg-field">Public GitHub repository<input value={repository} onChange={e => setRepository(e.target.value)} maxLength={200} placeholder="owner/repository" required /></label><button className="lg-button" disabled={busy}>{busy ? 'Inspecting bounded source data…' : 'Assess public repository'}</button></form><p role="status">{error}</p>{result && <><h2>{result.repository}</h2><p>Commit <code>{result.commitSha?.slice(0, 12)}</code></p><h3>Detected stack</h3><ul>{result.stack?.filter(s => s.status !== 'NOT_DETECTED').map(s => <li key={s.name}>{s.name}: {s.status}</li>)}</ul><h3>Recommended dynamic verification</h3><ul>{result.recommendations?.map(r => <li key={r.domain}>{r.statement} — requires confirmation</li>)}</ul><p>Coverage: {String(result.coverage?.status ?? 'UNSUPPORTED')}. Unsupported and excluded source is not verified.</p><Link className="lg-button" href="/app/projects" onClick={() => { void fetch('/api/public/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'assessment_connect_cta' }) }); }}>Verify this app</Link></>}</main>;
}
export function PublicAssurance({ kind, reference }: { kind: 'shares' | 'assurance'; reference: string }) {
  const [result, setResult] = useState<Result | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/public/${kind}/${encodeURIComponent(reference)}`, { cache: 'no-store', signal: controller.signal }).then(async r => { if (!r.ok) throw new Error(); setResult(await r.json()); }).catch(() => { if (!controller.signal.aborted) setError('This assurance link is unavailable, expired, or revoked.'); });
    return () => controller.abort();
  }, [kind, reference]);
  return <main className="lg lg-panel-body lg-public-result" style={{ maxWidth: 900, margin: 'auto' }}><Link href="/">LaunchGate</Link><h1>Release assurance</h1>{error ? <p role="alert">{error}</p> : !result ? <p role="status">Loading assurance…</p> : <><h2>{result.displayName}</h2>{result.purpose === 'REFERENCE_LAB' && <p><strong>REFERENCE LAB — controlled fixture, not customer production assurance.</strong></p>}<h2>{result.state ?? result.decision ?? 'NOT_CONFIGURED'}</h2><p>{result.explanation}</p><p>Commit <code>{result.commit}</code> · Policy version {result.policyVersion} · Engine {result.engineVersion}</p><p>Evaluated {result.evaluatedAt}; {result.freshness ?? 'current tracked release projection'}.</p><h3>Tested scope</h3><ul>{Object.entries(result.coverage ?? {}).map(([key, value]) => <li key={key}>{key}: {String(value)}</li>)}</ul></>}<p>SHIP: LaunchGate release policy was satisfied for the tested scope.</p><p>BLOCK: One or more reproducible policy-blocking failures were found.</p><p>INCONCLUSIVE: Required assurance could not be completed.</p><p>Verified means the configured LaunchGate release policy was satisfied for the displayed release and tested scope. It does not imply absolute or permanent security.</p><Link href="/assess">Assess your app</Link></main>;
}
