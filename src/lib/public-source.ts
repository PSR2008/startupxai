import dns from "dns/promises";
import net from "net";

export const PUBLIC_SOURCE_LABEL = "Public source - founder selected";
export const PUBLIC_SOURCE_EXPLANATION =
  "StartupX AI retrieved source metadata. The founder is responsible for deciding how this source relates to the claim.";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = "StartupXAI-SourcePreview/1.0 (+https://startupxai.in)";

export type SourcePreviewErrorCode =
  | "invalid_url"
  | "blocked_private_address"
  | "redirect_blocked"
  | "too_many_redirects"
  | "unsupported_content_type"
  | "response_too_large"
  | "timeout"
  | "source_unavailable";

export class SourcePreviewError extends Error {
  constructor(public code: SourcePreviewErrorCode, message: string) {
    super(message);
    this.name = "SourcePreviewError";
  }
}

export interface PublicSourceMetadata {
  originalUrl: string;
  canonicalUrl: string;
  pageTitle: string | null;
  description: string | null;
  publisher: string | null;
  author: string | null;
  publicationDate: string | null;
  retrievedAt: string;
  language: string | null;
  faviconUrl: string | null;
  hostname: string;
  httpStatus: number;
  contentType: string;
  excerpt: string | null;
  label: typeof PUBLIC_SOURCE_LABEL;
  explanation: typeof PUBLIC_SOURCE_EXPLANATION;
}

export interface SourcePreviewResult {
  metadata: PublicSourceMetadata;
  warnings: string[];
}

export interface FetchPublicSourceOptions {
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 198 && (b === 18 || b === 19) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe80:") ||
    value.startsWith("::ffff:127.") ||
    value.startsWith("::ffff:10.") ||
    value.startsWith("::ffff:192.168.")
  );
}

export function normalizePublicSourceUrl(value?: string | null): URL | null {
  if (!value?.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function sanitizeUrlForAnalytics(value: string): string {
  const url = normalizePublicSourceUrl(value);
  if (!url) return "invalid";
  url.search = "";
  return url.toString();
}

export async function assertPublicSourceUrl(
  value?: string | null,
  resolveHost: FetchPublicSourceOptions["resolveHost"] = (hostname) => dns.lookup(hostname, { all: true, verbatim: true })
): Promise<URL | null> {
  const url = normalizePublicSourceUrl(value);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) return null;

  const literalType = net.isIP(hostname);
  if (literalType === 4) return isPrivateIpv4(hostname) ? null : url;
  if (literalType === 6) return isPrivateIpv6(hostname) ? null : url;
  if (!hostname.includes(".")) return null;

  try {
    const records = await resolveHost(hostname);
    if (!records.length) return null;
    const blocked = records.some((record) => {
      if (record.family === 4) return isPrivateIpv4(record.address);
      if (record.family === 6) return isPrivateIpv6(record.address);
      return true;
    });
    return blocked ? null : url;
  } catch {
    return null;
  }
}

function metadataContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property|itemprop)=["']${escaped}["'][^>]*>`, "i");
  return decodeHtml(pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1] ?? "") || null;
}

function linkHref(html: string, rel: string): string | null {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>`, "i");
  const reversePattern = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]*>`, "i");
  return decodeHtml(pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1] ?? "") || null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function excerpt(value: string | null, max = 280): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}…` : cleaned;
}

function resolvePageUrl(base: URL, value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourcePreviewError("response_too_large", "The source response is too large to preview.");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

function parseMetadata(html: string, finalUrl: URL, response: Response, originalUrl: string, now: Date): PublicSourceMetadata {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const pageTitle =
    metadataContent(html, "og:title") ??
    metadataContent(html, "twitter:title") ??
    (decodeHtml(titleMatch?.[1] ?? "") || null);
  const description = excerpt(metadataContent(html, "description") ?? metadataContent(html, "og:description") ?? metadataContent(html, "twitter:description"));
  const publisher = metadataContent(html, "og:site_name") ?? metadataContent(html, "publisher") ?? null;
  const author = metadataContent(html, "author");
  const publicationDate =
    metadataContent(html, "article:published_time") ??
    metadataContent(html, "datePublished") ??
    metadataContent(html, "publishdate") ??
    metadataContent(html, "dc.date") ??
    null;
  const lang = /<html[^>]+lang=["']?([a-zA-Z0-9_-]+)/i.exec(html)?.[1] ?? null;
  const canonicalUrl = resolvePageUrl(finalUrl, linkHref(html, "canonical")) ?? finalUrl.toString();
  const faviconUrl = resolvePageUrl(finalUrl, linkHref(html, "icon"));
  const fallbackExcerpt = excerpt(stripHtml(html));
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "unavailable";

  return {
    originalUrl,
    canonicalUrl,
    pageTitle,
    description,
    publisher,
    author,
    publicationDate,
    retrievedAt: now.toISOString(),
    language: lang,
    faviconUrl,
    hostname: finalUrl.hostname,
    httpStatus: response.status,
    contentType,
    excerpt: description ?? fallbackExcerpt,
    label: PUBLIC_SOURCE_LABEL,
    explanation: PUBLIC_SOURCE_EXPLANATION,
  };
}

export async function fetchPublicSourceMetadata(value: string, options: FetchPublicSourceOptions = {}): Promise<SourcePreviewResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const original = await assertPublicSourceUrl(value, resolveHost);
  if (!original) throw new SourcePreviewError("invalid_url", "Enter a valid public HTTP or HTTPS URL.");

  let current = original;
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,text/plain;q=0.5",
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new SourcePreviewError("timeout", "The source took too long to respond.");
      throw new SourcePreviewError("source_unavailable", "The source could not be reached.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new SourcePreviewError("redirect_blocked", "The source redirected without a valid destination.");
      if (redirectCount === maxRedirects) throw new SourcePreviewError("too_many_redirects", "The source redirected too many times.");
      const nextUrl = new URL(location, current).toString();
      const safeRedirect = await assertPublicSourceUrl(nextUrl, resolveHost);
      if (!safeRedirect) throw new SourcePreviewError("redirect_blocked", "The source redirected to a blocked destination.");
      current = safeRedirect;
      continue;
    }
    break;
  }

  if (!response) throw new SourcePreviewError("source_unavailable", "The source could not be reached.");
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  if (!["text/html", "application/xhtml+xml", "text/plain"].includes(contentType)) {
    throw new SourcePreviewError("unsupported_content_type", "Only public text or HTML pages can be added as URL evidence.");
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new SourcePreviewError("response_too_large", "The source response is too large to preview.");
  }

  const html = await readLimitedText(response, maxBytes);
  const warnings: string[] = [];
  const metadata = parseMetadata(html, current, response, original.toString(), options.now?.() ?? new Date());
  if (!metadata.pageTitle) warnings.push("Page title unavailable");
  if (!metadata.description) warnings.push("Meta description unavailable");
  if (!metadata.publisher) warnings.push("Publisher unavailable");
  if (!metadata.publicationDate) warnings.push("Publication date unavailable");
  return { metadata, warnings };
}

export function detectDuplicatePublicSource(
  metadata: Pick<PublicSourceMetadata, "originalUrl" | "canonicalUrl">,
  rows: Array<{ id: string; title: string; source_url?: string | null; raw_metadata?: Record<string, unknown> | null }>
) {
  const candidates = new Set([metadata.originalUrl, metadata.canonicalUrl].filter(Boolean).map((value) => normalizePublicSourceUrl(value)?.toString()).filter(Boolean));
  return rows.find((row) => {
    const rowUrls = [
      row.source_url,
      typeof row.raw_metadata?.canonicalUrl === "string" ? row.raw_metadata.canonicalUrl : null,
      typeof row.raw_metadata?.originalUrl === "string" ? row.raw_metadata.originalUrl : null,
    ];
    return rowUrls.some((url) => {
      const normalized = normalizePublicSourceUrl(url)?.toString();
      return normalized ? candidates.has(normalized) : false;
    });
  }) ?? null;
}
