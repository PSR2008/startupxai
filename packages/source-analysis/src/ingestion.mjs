import { createHash } from "node:crypto";

export const limits = Object.freeze({ files: 200, treeEntries: 2000, totalBytes: 2097152, fileBytes: 65536, pathLength: 240, depth: 20, durationMs: 30000, parseMs: 5000 });
export const hash = value => createHash("sha256").update(value).digest("hex");
export const canonicalJson = value => value !== null && typeof value === "object"
  ? Array.isArray(value) ? `[${value.map(canonicalJson).join(",")}]`
    : `{${Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  : JSON.stringify(value);
export const gitHash = bytes => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
/** Conservative defense, not a claim of perfect detection. Never persist raw diagnostics. */
export function redact(text) {
  const replace = value => "[REDACTED]" + "\n".repeat((value.match(/\n/g) || []).length);
  return text.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace)
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`]+/gi, replace)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, replace)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replace)
    .replace(/\b(?:sk-(?:ant-)?|gh[pousr]_|github_pat_|AKIA|whsec_|rk_live_|sk_live_|sk_test_)[A-Za-z0-9_-]{8,}/g, replace)
    .replace(/((?:api[_-]?key|secret|password|access[_-]?token|private[_-]?key)\s*[=:]\s*["'`])[^"'`\r\n]+/gi, "$1[REDACTED]");
}
export function safePath(path, bounds = limits) {
  if (typeof path !== "string" || !path || path.length > bounds.pathLength || !/^[A-Za-z0-9_.@() /-]+$/.test(path) || path.startsWith("/") || path.includes("\\") || path.split("/").length > bounds.depth || redact(path) !== path) return false;
  return path.split("/").every(part => part && part !== "." && part !== ".." && !part.endsWith(".") && !part.endsWith(" ") && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part) && part.toLowerCase() !== ".git");
}
export function classify(path, bytes) {
  if (bytes.includes(0)) return "BINARY";
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return "BINARY"; }
  if (/[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return "BINARY";
  if (/(^|\/)(node_modules|\.next|dist|build|coverage|vendor|generated)(\/|$)/i.test(path) || /@generated|DO NOT EDIT/.test(text.slice(0,500))) return "GENERATED";
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(path)) return "LOCKFILE";
  if (/\.(png|jpe?g|gif|webp|svg|mp4|woff2?|ico)$/i.test(path)) return "MEDIA";
  if (/(^|\/)package\.json$/.test(path)) return "MANIFEST";
  if (/\.sql$/i.test(path)) return "MIGRATION";
  if (/\.(md|txt|rst)$/i.test(path)) return "DOCUMENTATION";
  if (/(\.test\.|\.spec\.|(^|\/)__tests__\/)/.test(path)) return "TEST";
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) return "SOURCE";
  if (/(^|\/)(vercel\.json|next\.config\.[a-z]+|tsconfig\.json)$/.test(path) || /\.(json|ya?ml|toml)$/.test(path)) return "CONFIGURATION";
  return "UNKNOWN";
}
/** Reader is a capability for a single immutable Git blob, not a URL or filesystem. */
export async function ingest(entries, readBlob, options = {}) {
  const bound = { ...limits, ...(options.limits || {}) };
  for (const key of Object.keys(limits)) if (!Number.isSafeInteger(bound[key]) || bound[key] < 1 || bound[key] > limits[key]) throw new Error("INVALID_LIMIT");
  const root = options.root || "";
  if (root && !safePath(root, bound)) throw new Error("UNSAFE_ROOT");
  if (!Array.isArray(entries) || entries.length > bound.treeEntries || options.truncated) throw new Error("TREE_LIMIT");
  const start = Date.now(); const files = []; const coverage = []; const seen = new Set(); let total = 0, fetched = 0;
  for (const entry of [...entries].sort((a,b) => String(a.path).localeCompare(String(b.path), "en"))) {
    const key = typeof entry.path === "string" ? entry.path.toLowerCase() : "";
    if (!safePath(entry.path,bound) || seen.has(key)) { coverage.push({ pathHash: hash(String(entry.path)), reason: "UNSAFE_PATH" }); continue; }
    seen.add(key);
    if (root && !entry.path.startsWith(root+"/")) { coverage.push({ path: entry.path, reason: "OUTSIDE_ROOT" }); continue; }
    if (entry.type === "tree") continue;
    if (entry.type !== "blob" || !["100644","100755"].includes(entry.mode)) { coverage.push({ path: entry.path, reason: "SYMLINK_OR_SUBMODULE" }); continue; }
    if (!/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error("INVALID_BLOB");
    if (/(^|\/)(node_modules|\.next|dist|build|coverage|vendor|generated)(\/|$)/i.test(entry.path)) { coverage.push({ path:entry.path, reason:"GENERATED" }); continue; }
    if (/\.(zip|tar|gz|tgz|7z|rar)$/i.test(entry.path)) { coverage.push({path:entry.path,reason:"ARCHIVE_UNSUPPORTED"}); continue; }
    if (fetched >= bound.files || Date.now()-start >= bound.durationMs) { coverage.push({path:entry.path,reason:"ANALYSIS_LIMIT"}); continue; }
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > bound.fileBytes || total+entry.size > bound.totalBytes) { coverage.push({path:entry.path,reason:"BYTE_LIMIT"}); continue; }
    let timer;
    let bytes;
    try { bytes = await Promise.race([readBlob(entry.sha, bound.fileBytes),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("INGESTION_TIMEOUT")),Math.max(1,bound.durationMs-(Date.now()-start)));})]); }
    finally { clearTimeout(timer); }
    fetched++;
    if (!(bytes instanceof Uint8Array) || bytes.length !== entry.size || bytes.length > bound.fileBytes || total+bytes.length > bound.totalBytes || gitHash(bytes)!==entry.sha) throw new Error("BLOB_INTEGRITY");
    total += bytes.length;
    const classification = classify(entry.path,bytes);
    const included = ["SOURCE","MANIFEST","MIGRATION","CONFIGURATION"].includes(classification);
    files.push({ path:entry.path, blobSha:entry.sha, digest:hash(bytes), bytes:bytes.length, classification,
      ...(included ? {text:redact(new TextDecoder().decode(bytes))} : {}) });
    if (!included) coverage.push({path:entry.path,reason:classification});
  }
  return { files, coverage, totalBytes:total, status:coverage.length ? "PARTIAL" : "COMPLETE" };
}
