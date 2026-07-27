import type { EvidenceEngineInput, EvidenceItem, ProviderRunStatus } from "./evidence-types";
import { assertPublicHttpUrl, normalizeHttpUrl } from "./safe-url";

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_CHARS = 120_000;

function evidenceId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function getTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function splitCompetitorUrls(input?: string): string[] {
  if (!input) return [];
  const matches = input.match(/https?:\/\/[^\s,]+/gi) ?? [];
  return Array.from(new Set(matches)).slice(0, 5);
}

function founderEvidence(input: EvidenceEngineInput): EvidenceItem[] {
  const now = new Date().toISOString();
  const items: EvidenceItem[] = [
    {
      id: evidenceId("ev"),
      evidenceCategory: "problem_clarity",
      title: "Founder-stated problem and solution",
      summary: input.ideaDescription,
      sourceName: "Founder input",
      sourceType: "founder-provided evidence",
      accessedAt: now,
      excerpt: input.ideaDescription,
      relevanceScore: 70,
      reliabilityScore: 45,
      sentiment: "neutral",
      direction: "supports",
      verifiedStatus: "user_provided",
      rawMetadata: { field: "ideaDescription" },
    },
    {
      id: evidenceId("ev"),
      evidenceCategory: "customer_urgency",
      title: "Founder-defined target customer",
      summary: input.targetCustomer,
      sourceName: "Founder input",
      sourceType: "founder-provided evidence",
      accessedAt: now,
      excerpt: input.targetCustomer,
      relevanceScore: 65,
      reliabilityScore: 45,
      sentiment: "neutral",
      direction: "supports",
      verifiedStatus: "user_provided",
      rawMetadata: { field: "targetCustomer" },
    },
    {
      id: evidenceId("ev"),
      evidenceCategory: "monetisation_potential",
      title: "Founder-stated business model",
      summary: input.businessModel,
      sourceName: "Founder input",
      sourceType: "founder-provided evidence",
      accessedAt: now,
      excerpt: input.businessModel,
      relevanceScore: 60,
      reliabilityScore: 45,
      sentiment: "neutral",
      direction: "supports",
      verifiedStatus: "user_provided",
      rawMetadata: { field: "businessModel" },
    },
  ];

  if (input.knownCompetitors?.trim()) {
    items.push({
      id: evidenceId("ev"),
      evidenceCategory: "existing_alternatives",
      title: "Known alternatives supplied by founder",
      summary: input.knownCompetitors.trim(),
      sourceName: "Founder input",
      sourceType: "founder-provided evidence",
      accessedAt: now,
      excerpt: input.knownCompetitors.trim(),
      relevanceScore: 68,
      reliabilityScore: 45,
      sentiment: "mixed",
      direction: "neutral",
      verifiedStatus: "user_provided",
      rawMetadata: { field: "knownCompetitors" },
    });
  }

  if (input.mainAssumptions?.trim()) {
    items.push({
      id: evidenceId("ev"),
      evidenceCategory: "evidence_strength",
      title: "Founder-stated assumptions",
      summary: input.mainAssumptions.trim(),
      sourceName: "Founder input",
      sourceType: "founder-provided evidence",
      accessedAt: now,
      excerpt: input.mainAssumptions.trim(),
      relevanceScore: 72,
      reliabilityScore: 45,
      sentiment: "neutral",
      direction: "neutral",
      verifiedStatus: "user_provided",
      rawMetadata: { field: "mainAssumptions" },
    });
  }

  return items;
}

async function fetchMetadataEvidence(urlValue: string, category: EvidenceItem["evidenceCategory"], label: string): Promise<EvidenceItem | null> {
  const url = await assertPublicHttpUrl(urlValue);
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "StartupXAI-EvidenceEngine/1.0" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 300_000) return null;
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    const title = getTitle(html) || url.hostname;
    const description = getMeta(html, "description") || getMeta(html, "og:description") || stripTags(html).slice(0, 260);
    const now = new Date().toISOString();

    return {
      id: evidenceId("ev"),
      evidenceCategory: category,
      title: `${label}: ${title}`,
      summary: description || "Website metadata was retrieved, but no concise description was available.",
      sourceName: url.hostname,
      sourceUrl: url.toString(),
      sourceType: label === "Competitor website" ? "competitor website" : "public company page",
      publishedOrRetrievedAt: now,
      accessedAt: now,
      excerpt: description || title,
      relevanceScore: 74,
      reliabilityScore: 70,
      sentiment: "neutral",
      direction: "supports",
      verifiedStatus: "verified",
      rawMetadata: { status: response.status, title, description },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectEvidence(input: EvidenceEngineInput): Promise<{
  evidenceItems: EvidenceItem[];
  providerRuns: ProviderRunStatus[];
}> {
  const evidenceItems = founderEvidence(input);
  const providerRuns: ProviderRunStatus[] = [
    {
      providerName: "Founder input",
      status: "success",
      message: "Founder-provided claims were recorded as user-provided evidence, not verified market facts.",
      metadata: { itemCount: evidenceItems.length },
    },
  ];

  if (input.websiteUrl && normalizeHttpUrl(input.websiteUrl)) {
    const item = await fetchMetadataEvidence(input.websiteUrl, "differentiation", "Startup website");
    if (item) {
      evidenceItems.push(item);
      providerRuns.push({ providerName: "Website metadata", status: "success", message: "Public website metadata retrieved with SSRF protections.", metadata: { url: item.sourceUrl } });
    } else {
      providerRuns.push({ providerName: "Website metadata", status: "failed", message: "Website metadata could not be retrieved or the URL was not safe/public." });
    }
  } else {
    providerRuns.push({ providerName: "Website metadata", status: "skipped", message: "No startup website URL was provided." });
  }

  const competitorUrls = splitCompetitorUrls(input.knownCompetitors);
  for (const competitorUrl of competitorUrls) {
    const item = await fetchMetadataEvidence(competitorUrl, "competitor_saturation", "Competitor website");
    if (item) evidenceItems.push(item);
  }
  providerRuns.push({
    providerName: "Competitor website metadata",
    status: competitorUrls.length ? "success" : "skipped",
    message: competitorUrls.length
      ? `${competitorUrls.length} competitor URL(s) checked; available metadata was added as verified evidence.`
      : "No competitor URLs were provided.",
    metadata: { checkedUrls: competitorUrls.length },
  });

  providerRuns.push(
    {
      providerName: "Web search provider",
      status: "not_configured",
      message: "Automatic public web research is not currently enabled. You can still add attributed public URLs manually.",
    },
    {
      providerName: "Reddit provider",
      status: "not_configured",
      message: "Reddit evidence is not collected automatically. Relevant posts or comments can be added manually as attributed evidence.",
    },
    {
      providerName: "Product Hunt provider",
      status: "not_configured",
      message: "Product Hunt evidence is not collected automatically. Relevant launch pages can be added manually as attributed evidence.",
    },
  );

  return { evidenceItems, providerRuns };
}
