import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const convertedTools = [
  "src/app/(app)/evidence-engine/page.tsx",
  "src/app/(app)/competitor-intelligence/page.tsx",
  "src/app/(app)/idea-engine/page.tsx",
  "src/app/(app)/revenue-engine/page.tsx",
  "src/app/(app)/user-psychology/page.tsx",
  "src/app/(app)/growth-engine/page.tsx",
  "src/app/(app)/founder-decision/page.tsx",
  "src/app/(app)/cold-dm/page.tsx",
  "src/app/(app)/brand-forge/page.tsx",
];

function source(file: string) {
  return readFileSync(join(process.cwd(), file), "utf8");
}

test("assessment tools no longer use side-by-side input and result split layouts", () => {
  for (const file of convertedTools) {
    const text = source(file);
    assert.equal(text.includes("lg:grid-cols-5"), false, `${file} still uses the old split-panel grid`);
    assert.equal(text.includes("xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]"), false, `${file} still uses the old evidence split-panel grid`);
    assert.ok(text.includes("mt-8 space-y-8"), `${file} should use vertical input/result stages`);
  }
});

test("initial assessment input stage is centered and result stage is hidden", () => {
  for (const file of convertedTools) {
    const text = source(file);
    assert.ok(text.includes('status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"'), `${file} should center the input stage`);
    assert.ok(text.includes('status === "idle" ? "hidden"'), `${file} should hide the result stage in input mode`);
  }
});

test("one-time tool results expose edit and rerun actions without changing payloads", () => {
  for (const file of convertedTools.filter((item) => !item.includes("evidence-engine"))) {
    const text = source(file);
    assert.ok(text.includes("Edit inputs"), `${file} missing Edit inputs action`);
    assert.ok(text.includes("Run again"), `${file} missing Run again action`);
    assert.ok(text.includes("handleSubmit()"), `${file} should rerun through the existing submit handler`);
    assert.ok(text.includes('if (status === "loading") return;'), `${file} should prevent duplicate submissions`);
  }
});

test("error states preserve inputs and offer retry plus edit actions", () => {
  for (const file of convertedTools.filter((item) => !item.includes("competitor-intelligence"))) {
    const text = source(file);
    const retryHandler = file.includes("evidence-engine") ? "onRetry={submit}" : "onRetry={handleSubmit}";
    assert.ok(text.includes(retryHandler), `${file} should retry with existing inputs`);
    assert.ok(text.includes("Edit inputs") || text.includes("Edit project inputs"), `${file} should let users reopen inputs after an error`);
  }
  const competitor = source("src/app/(app)/competitor-intelligence/page.tsx");
  assert.ok(competitor.includes("onRetry={() => handleSubmit({ retry: true })}"));
  assert.ok(competitor.includes("onEdit={() => setStatus(\"idle\")}"));
});

test("old split-panel helper copy is not shown in converted tools", () => {
  for (const file of convertedTools) {
    const text = source(file);
    assert.equal(/on the right|on the left/i.test(text), false, `${file} still references side-by-side placement`);
  }
});

test("pages intentionally not converted are not assessment input-output tools", () => {
  const intentionallyUnconverted = [
    "src/app/(app)/dashboard/page.tsx",
    "src/app/(app)/reports/page.tsx",
    "src/app/(app)/profile/page.tsx",
    "src/app/(app)/payment/page.tsx",
  ];
  for (const file of intentionallyUnconverted) {
    const text = source(file);
    assert.equal(text.includes("setResult(data.data)"), false, `${file} appears to be an assessment result workflow`);
  }
});
