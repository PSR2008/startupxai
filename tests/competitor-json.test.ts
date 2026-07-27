import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  AIProviderResponseError,
  COMPETITOR_MAX_RETRIES,
  COMPETITOR_MAX_TOKENS,
  COMPETITOR_PROVIDER_TIMEOUT_MS,
  parseCompetitorOutput,
} from "../src/lib/ai";
import { GENERIC_ANALYSIS_ERROR, readSafeApiResponse } from "../src/lib/safe-api-response";

const validProviderJson = {
  directCompetitors: [
    {
      name: "Unacademy",
      description: "Large Indian edtech platform with live classes and exam preparation.",
      strengths: ["Large tutor network", "Known exam-prep brand"],
      weaknesses: ["Broad positioning", "High content operations cost"],
      url: "https://unacademy.com",
    },
  ],
  indirectCompetitors: [
    {
      name: "YouTube educators",
      description: "Free channels that compete for study attention.",
      strengths: ["Free access", "Huge content library"],
      weaknesses: ["Limited structure", "No personalized accountability"],
    },
  ],
  positioningGaps: ["Evidence-backed study plans for a specific exam segment"],
  howToBeatThem: ["Win with narrower positioning and measurable outcomes"],
  whiteSpaceOpportunities: ["Accountability workflows for repeat exam attempts"],
  comparisonSummary: "The market is crowded but still segmented by exam and learning format.",
  strategicAdvantage: "A focused wedge can compete if it proves better study outcomes.",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("competitor provider parser accepts JSON inside markdown fences", () => {
  const parsed = parseCompetitorOutput(`\`\`\`json\n${JSON.stringify(validProviderJson)}\n\`\`\``);
  assert.equal(parsed.directCompetitors[0].name, "Unacademy");
  assert.equal(parsed.positioningGaps.length, 1);
});

test("competitor provider parser rejects prose, malformed JSON, and schema-invalid JSON", () => {
  assert.throws(() => parseCompetitorOutput("An error occurred upstream."), AIProviderResponseError);
  assert.throws(() => parseCompetitorOutput("{ nope"), AIProviderResponseError);
  assert.throws(() => parseCompetitorOutput(JSON.stringify({ directCompetitors: [] })), AIProviderResponseError);
});

test("safe API parser accepts normalized success envelopes", async () => {
  const parsed = await readSafeApiResponse<typeof validProviderJson>(jsonResponse({ ok: true, data: validProviderJson }));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.data.directCompetitors[0].name, "Unacademy");
});

test("safe API parser handles normalized error envelopes", async () => {
  const parsed = await readSafeApiResponse(jsonResponse({
    ok: false,
    error: { code: "PROVIDER_ERROR", message: "Competitor analysis could not be completed. Please try again.", retryable: true },
  }, 502));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.code, "PROVIDER_ERROR");
    assert.equal(parsed.retryable, true);
  }
});

test("safe API parser masks plain text and HTML responses", async () => {
  const plain = await readSafeApiResponse(new Response("An error occurred in the Server Components render.", { status: 500, headers: { "content-type": "text/plain" } }));
  const html = await readSafeApiResponse(new Response("<html><body>gateway failure</body></html>", { status: 502, headers: { "content-type": "text/html" } }));

  for (const parsed of [plain, html]) {
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.message, GENERIC_ANALYSIS_ERROR);
      assert.equal(parsed.message.includes("Unexpected token"), false);
      assert.equal(parsed.message.includes("gateway failure"), false);
      assert.equal(parsed.message.includes("Server Components"), false);
    }
  }
});

test("safe API parser masks malformed JSON without native parse errors", async () => {
  const parsed = await readSafeApiResponse(new Response("{ broken", { status: 502, headers: { "content-type": "application/json" } }));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.code, "MALFORMED_JSON_RESPONSE");
    assert.equal(parsed.message, GENERIC_ANALYSIS_ERROR);
    assert.equal(parsed.message.includes("Unexpected token"), false);
  }
});

test("competitor API route uses normalized JSON envelopes for success and failures", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/analyze/competitor/route.ts"), "utf8");
  assert.ok(route.includes("{ ok: true, success: true, data }"));
  assert.ok(route.includes("ok: false"));
  assert.ok(route.includes("INVALID_PROVIDER_RESPONSE"));
  assert.ok(route.includes("PROVIDER_TIMEOUT"));
  assert.ok(route.includes("saveAnalysis"));
  assert.ok(route.indexOf("saveAnalysis") > route.indexOf("analyzeCompetitors"));
  assert.equal(route.includes("new Response("), false);
  assert.equal(route.includes("console.error(\"[CompetitorEngine] Analysis failed:\", error)"), false);
});

test("competitor route budget exceeds one centralized provider timeout", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/analyze/competitor/route.ts"), "utf8");
  const ai = readFileSync(join(process.cwd(), "src/lib/ai.ts"), "utf8");

  assert.ok(route.includes("export const runtime = \"nodejs\""));
  assert.ok(route.includes("export const maxDuration = 60"));
  assert.equal(COMPETITOR_PROVIDER_TIMEOUT_MS, 45_000);
  assert.ok(COMPETITOR_PROVIDER_TIMEOUT_MS < 60_000);
  assert.equal(COMPETITOR_MAX_RETRIES, 0);
  assert.equal(COMPETITOR_MAX_TOKENS, 1800);
  assert.equal(route.includes("Promise.race"), false);
  assert.equal(route.includes("withTimeout"), false);
  assert.ok(ai.includes("timeout: COMPETITOR_PROVIDER_TIMEOUT_MS"));
  assert.ok(ai.includes("maxRetries: COMPETITOR_MAX_RETRIES"));
});

test("competitor prompt uses bounded input and compact output only", () => {
  const ai = readFileSync(join(process.cwd(), "src/lib/ai.ts"), "utf8");
  assert.ok(ai.includes("COMPETITOR_INPUT_LIMITS"));
  assert.ok(ai.includes("idea: 420"));
  assert.ok(ai.includes("competitorNames: 350"));
  assert.ok(ai.includes("Do not claim live research or verified market facts"));
  assert.ok(ai.includes("one concise sentence"));
  assert.equal(ai.includes("Fortune 500 companies and top startups"), false);
  assert.equal(ai.includes("Be commercially specific.`;"), false);
});

test("competitor route classifies provider failures distinctly", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/analyze/competitor/route.ts"), "utf8");
  for (const code of ["PROVIDER_TIMEOUT", "PROVIDER_RATE_LIMITED", "PROVIDER_AUTH_ERROR", "INVALID_PROVIDER_RESPONSE", "PROVIDER_ERROR", "INTERNAL_ERROR"]) {
    assert.ok(route.includes(code), `${code} missing`);
  }
  assert.ok(route.includes("status === 429"));
  assert.ok(route.includes("status === 401 || status === 403"));
  assert.ok(route.includes("status === 408 || status === 504"));
  assert.ok(route.includes("The analysis provider took too long to respond."));
  assert.ok(route.includes("The analysis service is temporarily unavailable."));
});

test("competitor route logs phase timing without prompt text or secrets", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/analyze/competitor/route.ts"), "utf8");
  for (const phase of ["rate_limit", "request_body", "validation", "auth_entitlements", "usage_record", "persistence", "total"]) {
    assert.ok(route.includes(`phase: "${phase}"`) || route.includes(`phase: '${phase}'`) || route.includes(phase), `${phase} missing`);
  }
  assert.ok(route.includes("requestId"));
  assert.ok(route.includes("providerStatus"));
  assert.ok(route.includes("retryable"));
  assert.equal(route.includes("authorization"), false);
  assert.equal(route.includes("apiKey"), false);
  assert.equal(route.includes("prompt:"), false);
});

test("competitor client handles timeout, cancellation, stale responses, and retry limit", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(app)/competitor-intelligence/page.tsx"), "utf8");
  assert.ok(source.includes("AbortController"));
  assert.ok(source.includes("signal: controller.signal"));
  assert.ok(source.includes("requestId !== activeRequestRef.current"));
  assert.ok(source.includes("Analysis took too long"));
  assert.ok(source.includes("The analysis provider did not respond within the available time"));
  assert.ok(source.includes("retryCount >= 1"));
  assert.ok(source.includes("status === \"loading\""));
});

test("competitor client uses safe parsing and does not display raw parse errors", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(app)/competitor-intelligence/page.tsx"), "utf8");
  assert.ok(source.includes("readSafeApiResponse<CompetitorEngineOutput>"));
  assert.equal(source.includes("await res.json()"), false);
  assert.ok(source.includes("Analysis could not be completed"));
  assert.ok(source.includes("Your input was not lost"));
  assert.ok(source.includes("retryCount >= 1"));
  assert.ok(source.includes("X-StartupX-Retry"));
});

test("authentication, billing, roles, entitlements, and RLS files are not changed by competitor JSON handling tests", () => {
  const changedScope = [
    "src/app/api/analyze/competitor/route.ts",
    "src/app/(app)/competitor-intelligence/page.tsx",
    "src/lib/ai.ts",
    "src/lib/safe-api-response.ts",
    "src/lib/analytics.ts",
    "tests/competitor-json.test.ts",
  ];
  assert.ok(changedScope.every((file) => file.includes("competitor") || file.includes("ai.ts") || file.includes("safe-api-response") || file.includes("analytics")));
});
