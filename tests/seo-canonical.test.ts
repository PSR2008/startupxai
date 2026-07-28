import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import { SEO_BASE_URL, canonicalUrl } from "../src/lib/seo";

function source(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

test("homepage has preferred www metadata base and self-referencing canonical", () => {
  const layout = source("src/app/layout.tsx");
  const home = source("src/app/page.tsx");
  assert.equal(SEO_BASE_URL, "https://www.startupxai.in");
  assert.match(layout, /metadataBase:\s*new URL\(SEO_BASE_URL\)/);
  assert.match(home, /alternates:\s*\{[\s\S]*canonical:\s*"\/",?[\s\S]*\}/);
  assert.match(home, /openGraph:\s*\{[\s\S]*url:\s*"\/",?[\s\S]*\}/);
  assert.equal(canonicalUrl("/"), "https://www.startupxai.in/");
});

test("referral homepage URLs resolve to the clean canonical homepage", () => {
  const referralUrl = new URL("https://www.startupxai.in/?ref=launches.uicomet.com");
  assert.equal(referralUrl.searchParams.get("ref"), "launches.uicomet.com");
  assert.equal(canonicalUrl(referralUrl.pathname), "https://www.startupxai.in/");
  assert.equal(canonicalUrl(referralUrl.pathname).includes("?"), false);
});

test("public indexable pages have self-referencing canonicals and Open Graph URLs", () => {
  const pages = [
    ["/pricing", "src/app/(marketing)/pricing/page.tsx"],
    ["/methodology", "src/app/(marketing)/methodology/page.tsx"],
    ["/privacy", "src/app/(marketing)/privacy/page.tsx"],
    ["/support", "src/app/(marketing)/support/layout.tsx"],
  ] as const;

  for (const [path, file] of pages) {
    const page = source(file);
    assert.match(page, new RegExp(`alternates:\\s*\\{[\\s\\S]*canonical:\\s*"${path}",?[\\s\\S]*\\}`));
    assert.match(page, new RegExp(`openGraph:\\s*\\{[\\s\\S]*url:\\s*"${path}",?[\\s\\S]*\\}`));
    assert.equal(canonicalUrl(path), `https://www.startupxai.in${path}`);
  }
});

test("sitemap contains only canonical www public URLs", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);
  assert.deepEqual(urls, [
    "https://www.startupxai.in/",
    "https://www.startupxai.in/pricing",
    "https://www.startupxai.in/methodology",
    "https://www.startupxai.in/support",
    "https://www.startupxai.in/privacy",
  ]);
  assert.ok(urls.every((url) => url.startsWith("https://www.startupxai.in")));
  assert.ok(urls.every((url) => !url.includes("?") && !url.startsWith("http://") && !url.includes("startupxai.in.in")));
  for (const excluded of ["/dashboard", "/payment", "/signin", "/signup", "/api/", "/reports"]) {
    assert.equal(urls.some((url) => url.includes(excluded)), false, `${excluded} should not be in sitemap`);
  }
});

test("robots sitemap points at the preferred canonical sitemap URL", () => {
  assert.equal(robots().sitemap, "https://www.startupxai.in/sitemap.xml");
});

test("private app and payment routes do not define page-level canonical metadata", () => {
  const files = [
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/payment/page.tsx",
    "src/app/(app)/reports/page.tsx",
    "src/app/(app)/reports/[id]/page.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.equal(/alternates\s*:\s*\{[\s\S]*canonical/.test(source), false, `${file} should not define canonical metadata`);
  }
});

test("SEO canonical change does not touch application behavior surfaces", () => {
  const changedSurface = [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/sitemap.ts",
    "src/app/robots.ts",
    "src/app/(marketing)/pricing/page.tsx",
    "src/app/(marketing)/methodology/page.tsx",
    "src/app/(marketing)/support/layout.tsx",
    "src/lib/seo.ts",
  ].map(source).join("\n");
  assert.equal(changedSurface.includes("Razorpay"), false);
  assert.equal(changedSurface.includes("supabase"), false);
  assert.equal(changedSurface.includes("calculateEvidenceScores"), false);
});
