"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorCopy } from "./client";
export type Row = Record<string, unknown>;
export const str = (row: Row | undefined, key: string, fallback = "") => typeof row?.[key] === "string" ? row[key] as string : fallback;
export const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
export const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
export function useData<T>(path: string | null, initial: T) {
 const fallback=useRef(initial);
 const [data, setData] = useState<{path:string|null;value:T}>({path,value:initial}), [loading, setLoading] = useState(!!path), [error, setError] = useState(""); const [revision, setRevision] = useState(0);
 const reload = useCallback(() => setRevision(x => x + 1), []);
 useEffect(() => { if (!path) { setLoading(false); return; } const controller = new AbortController(); setLoading(true); setError(""); api<T>(path, undefined, "GET", controller.signal).then(value => { if (!controller.signal.aborted) setData({path,value}); }).catch(e => { if (!controller.signal.aborted) { setData({path,value:fallback.current}); setError(errorCopy(e)); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [path, revision]);
 return { data: path && data.path===path ? data.value : initial, loading: !!path && (loading || data.path!==path), error: data.path===path?error:"", reload };
}
export function useCommand(reload: () => void) {
 const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
 async function command<T = unknown>(path: string, value: unknown = {}, method = "POST"): Promise<T | undefined> { setBusy(true); setError(""); setMessage(""); try { const data = await api<T>(path, value, method); setMessage("Request accepted. The displayed state comes from the server."); reload(); return data; } catch (e) { setError(errorCopy(e)); } finally { setBusy(false); } }
 return { command, busy, message, error };
}
