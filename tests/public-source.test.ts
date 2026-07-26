import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertPublicSourceUrl,
  detectDuplicatePublicSource,
  fetchPublicSourceMetadata,
  normalizePublicSourceUrl,
  sanitizeUrlForAnalytics,
  SourcePreviewError,
} from "../src/lib/public-source";
import { evidenceWorkflowSchema, isGeneratedAssessmentVerified, verifiedStatusForEvidenceType } from "../src/lib/evidence-workflow";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];
const privateResolver = async () => [{ address: "10.0.0.2", family: 4 }];

function htmlResponse(html: string, init: ResponseInit = {}) {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
    ...init,
  });
}

test("successful public webpage metadata retrieval", async () => {
  const result = await fetchPublicSourceMetadata("https://example.com/post?token=secret#section", {
    resolveHost: publicResolver,
    now: () => new Date("2026-07-26T10:00:00.000Z"),
    fetchImpl: async () => htmlResponse(`
      <html lang="en">
        <head>
          <title>Fallback title</title>
          <meta property="og:title" content="Public evidence title">
          <meta name="description" content="Short public source description.">
          <meta property="og:site_name" content="Example Publisher">
          <meta name="author" content="Jane Founder">
          <meta property="article:published_time" content="2026-07-01T00:00:00.000Z">
          <link rel="canonical" href="/canonical">
          <link rel="icon" href="/favicon.ico">
        </head>
      </html>
    `),
  });

  assert.equal(result.metadata.pageTitle, "Public evidence title");
  assert.equal(result.metadata.publisher, "Example Publisher");
  assert.equal(result.metadata.author, "Jane Founder");
  assert.equal(result.metadata.publicationDate, "2026-07-01T00:00:00.000Z");
  assert.equal(result.metadata.canonicalUrl, "https://example.com/canonical");
  assert.equal(result.metadata.faviconUrl, "https://example.com/favicon.ico");
  assert.equal(result.metadata.retrievedAt, "2026-07-26T10:00:00.000Z");
  assert.equal(result.metadata.label, "Public source - founder selected");
});

test("missing Open Graph metadata falls back without inventing values", async () => {
  const result = await fetchPublicSourceMetadata("https://example.com/minimal", {
    resolveHost: publicResolver,
    fetchImpl: async () => htmlResponse("<html><head><title>Minimal page</title></head><body>Visible excerpt only.</body></html>"),
  });

  assert.equal(result.metadata.pageTitle, "Minimal page");
  assert.equal(result.metadata.publisher, null);
  assert.equal(result.metadata.publicationDate, null);
  assert.ok(result.warnings.includes("Publisher unavailable"));
});

test("canonical URL handling and analytics URL sanitization remove fragments and query values", async () => {
  assert.equal(normalizePublicSourceUrl("https://example.com/a?x=1#frag")?.toString(), "https://example.com/a?x=1");
  assert.equal(sanitizeUrlForAnalytics("https://example.com/a?token=secret#frag"), "https://example.com/a");
});

test("redirect handling follows public redirects", async () => {
  const seen: string[] = [];
  const result = await fetchPublicSourceMetadata("https://example.com/start", {
    resolveHost: publicResolver,
    fetchImpl: async (url) => {
      seen.push(String(url));
      if (String(url).endsWith("/start")) return new Response("", { status: 302, headers: { location: "https://example.com/final" } });
      return htmlResponse("<title>Final page</title>");
    },
  });
  assert.deepEqual(seen, ["https://example.com/start", "https://example.com/final"]);
  assert.equal(result.metadata.pageTitle, "Final page");
});

test("redirect to private address is blocked", async () => {
  await assert.rejects(
    fetchPublicSourceMetadata("https://example.com/start", {
      resolveHost: async (hostname) => hostname === "example.com" ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "127.0.0.1", family: 4 }],
      fetchImpl: async () => new Response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    }),
    (err) => err instanceof SourcePreviewError && err.code === "redirect_blocked",
  );
});

test("localhost, private IPv4, private IPv6, cloud metadata, non-HTTP, and credentials are blocked", async () => {
  assert.equal(await assertPublicSourceUrl("http://localhost:3000", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("http://192.168.1.10", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("http://[::1]/", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("http://169.254.169.254/latest/meta-data", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("ftp://example.com/source", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("https://user:pass@example.com/source", publicResolver), null);
  assert.equal(await assertPublicSourceUrl("https://example.internal", privateResolver), null);
});

test("unsupported content type and oversized response are rejected", async () => {
  await assert.rejects(
    fetchPublicSourceMetadata("https://example.com/image.png", {
      resolveHost: publicResolver,
      fetchImpl: async () => new Response("png", { status: 200, headers: { "content-type": "image/png" } }),
    }),
    (err) => err instanceof SourcePreviewError && err.code === "unsupported_content_type",
  );

  await assert.rejects(
    fetchPublicSourceMetadata("https://example.com/large", {
      resolveHost: publicResolver,
      maxBytes: 10,
      fetchImpl: async () => htmlResponse("x".repeat(20), { headers: { "content-length": "20", "content-type": "text/html" } }),
    }),
    (err) => err instanceof SourcePreviewError && err.code === "response_too_large",
  );
});

test("timeout is surfaced as a safe user-facing error", async () => {
  await assert.rejects(
    fetchPublicSourceMetadata("https://example.com/slow", {
      resolveHost: publicResolver,
      timeoutMs: 1,
      fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
    }),
    (err) => err instanceof SourcePreviewError && err.code === "timeout",
  );
});

test("duplicate URL detection checks normalized and canonical URLs", () => {
  const duplicate = detectDuplicatePublicSource(
    { originalUrl: "https://example.com/a", canonicalUrl: "https://example.com/canonical" },
    [{ id: "ev_1", title: "Existing source", source_url: "https://example.com/canonical", raw_metadata: null }],
  );
  assert.equal(duplicate?.id, "ev_1");
});

test("saving attributed evidence payload is accepted while AI suggestion remains unverified", () => {
  const metadata = {
    originalUrl: "https://example.com/a",
    canonicalUrl: "https://example.com/canonical",
    pageTitle: "Source",
    description: "Excerpt",
    publisher: "Example",
    author: null,
    publicationDate: null,
    retrievedAt: "2026-07-26T10:00:00.000Z",
    language: "en",
    faviconUrl: null,
    hostname: "example.com",
    httpStatus: 200,
    contentType: "text/html",
    excerpt: "Excerpt",
    label: "Public source - founder selected",
    explanation: "StartupX AI retrieved source metadata. The founder is responsible for deciding how this source relates to the claim.",
  };
  const parsed = evidenceWorkflowSchema.safeParse({
    evidence_source: "public_url",
    evidence_type: "founder_provided_evidence",
    title: "Source",
    claim: "Buyers compare alternatives",
    description: "Founder thinks this supports competitor pressure.",
    evidence_direction: "supporting",
    source_url: metadata.canonicalUrl,
    source_name: "Example",
    source_quality: "medium",
    confidence: "low",
    collected_at: metadata.retrievedAt,
    evidence_status: "active",
    linked_claims: ["Buyers compare alternatives"],
    public_source_metadata: metadata,
  });
  assert.equal(parsed.success, true);
  assert.equal(verifiedStatusForEvidenceType("generated_assessment"), "inferred");
  assert.equal(isGeneratedAssessmentVerified("generated_assessment", "verified"), true);
});

test("full webpage content is not stored in the normalized metadata preview", async () => {
  const longArticle = `<html><head><title>Long page</title></head><body>${"full article text ".repeat(200)}</body></html>`;
  const result = await fetchPublicSourceMetadata("https://example.com/long", {
    resolveHost: publicResolver,
    fetchImpl: async () => htmlResponse(longArticle),
  });
  assert.ok((result.metadata.excerpt ?? "").length <= 281);
  assert.equal(JSON.stringify(result.metadata).includes("full article text ".repeat(20)), false);
});

test("API route enforces auth, ownership, rate limiting, audit logging, and duplicate handling", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/evidence/source-preview/route.ts"), "utf8");
  for (const text of ["getUserIdFromRequest", "requireProjectAccess", "generalRateLimiter", "recordProjectActivity", "detectDuplicatePublicSource"]) {
    assert.ok(route.includes(text), `${text} missing from source preview route`);
  }
});

test("evidence save route requires preview metadata and rejects duplicate public sources", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/evidence-projects/[projectId]/evidence/route.ts"), "utf8");
  for (const text of ["Fetch source details before saving a Public URL", "DUPLICATE_PUBLIC_SOURCE", "source_type: sourceType", "public_source_saved"]) {
    assert.ok(route.includes(text), `${text} missing from evidence save route`);
  }
});
