"use client";
import { useId, useRef, type ReactNode, type FormEvent } from "react";
import Link from "next/link";

export function Brand() { return <Link href="/" className="lg-brand" aria-label="LaunchGate home"><span className="lg-mark" aria-hidden="true">L<span>↗</span></span>LaunchGate<span className="lg-wordmark-dot">.</span></Link>; }
export function Status({ value = "NOT_RUN" }: { value?: string | null }) {
  const state = value ?? "NOT_RUN";
  const tone = /^(SHIP|PASS|VERIFIED|RESOLVED|COMPLETED)$/.test(state) ? "good" : /BLOCK|FAILURE|FAILED|REPRODUCED|REVOKED/.test(state) ? "bad" : /INCONCLUSIVE|STALE|DEGRADED|UNVERIFIED/.test(state) ? "warn" : "neutral";
  return <span className={`lg-status lg-status-${tone}`}><span aria-hidden="true">●</span>{state.replaceAll("_", " ")}</span>;
}
export function PageHeading({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children?: ReactNode; action?: ReactNode }) { return <header className="lg-page-heading"><div>{eyebrow && <p className="lg-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <p className="lg-muted">{children}</p>}</div>{action}</header>; }
export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) { return <section className="lg-panel">{title && <div className="lg-panel-heading"><h2>{title}</h2>{action}</div>}{children}</section>; }
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) { return <div className="lg-empty"><span className="lg-empty-icon" aria-hidden="true">◇</span><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function Alert({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`lg-alert ${error ? "lg-alert-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>; }
export function Loading() { return <div role="status" aria-label="Loading workspace" className="lg-skeleton"><span /><span /><span /><p>Loading workspace…</p></div>; }
export function Technical({ title = "Technical details", value }: { title?: string; value: unknown }) { return <details className="lg-technical"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>; }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { const id = useId(); return <label className="lg-field"><span>{label}</span>{children}{hint && <small id={id}>{hint}</small>}</label>; }
export function Form({ children, onSubmit, busy = false, label = "Save" }: { children: ReactNode; onSubmit: (values: FormData) => Promise<void>; busy?: boolean; label?: string }) {
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); void onSubmit(new FormData(e.currentTarget)); };
  return <form className="lg-form" onSubmit={submit}><fieldset disabled={busy}>{children}<button className="lg-button lg-primary" type="submit">{busy ? "Working…" : label}</button></fieldset></form>;
}
export function Confirm({ label, children, onConfirm, disabled }: { label: string; children: ReactNode; onConfirm: () => Promise<void>; disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const title = useId();
  return <><button className="lg-button lg-danger" disabled={disabled} onClick={() => dialog.current?.showModal()}>{label}</button><dialog ref={dialog} className="lg-dialog" aria-labelledby={title}><h2 id={title}>{label}?</h2><p>{children}</p><div className="lg-actions"><button className="lg-button" autoFocus onClick={() => dialog.current?.close()}>Keep current settings</button><button className="lg-button lg-danger" onClick={async () => { dialog.current?.close(); await onConfirm(); }}>{label}</button></div></dialog></>;
}
export function Timestamp({ value }: { value?: string }) { return value ? <time dateTime={value}>{new Date(value).toLocaleString()}</time> : <>Not recorded</>; }
export const shortId = (value?: string) => value ? value.slice(0, 8) : "—";
