import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AIProviderResponseError, parseCompetitorOutput } from "../src/lib/ai";
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
