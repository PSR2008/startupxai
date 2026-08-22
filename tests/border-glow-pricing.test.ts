import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const borderGlow = readFileSync(join(root, "src/components/ui/BorderGlow/BorderGlow.tsx"), "utf8");
const borderGlowStyles = readFileSync(join(root, "src/components/ui/BorderGlow/BorderGlow.css"), "utf8");
const borderGlowExports = readFileSync(join(root, "src/components/ui/BorderGlow/index.ts"), "utf8");
const homepagePricing = readFileSync(join(root, "src/components/marketing/EnginesSection.tsx"), "utf8");
const pricingPage = readFileSync(join(root, "src/app/(marketing)/pricing/page.tsx"), "utf8");

test("BorderGlow is a reusable client component with pointer-driven CSS variables", () => {
  assert.match(borderGlow, /"use client"/);
  assert.match(borderGlow, /type BorderGlowProps/);
  assert.match(borderGlow, /--border-glow-x/);
  assert.match(borderGlow, /--border-glow-y/);
  assert.match(borderGlow, /recommended/);
  assert.match(borderGlowStyles, /\.border-glow::before/);
  assert.match(borderGlowStyles, /\.border-glow::after/);
  assert.match(borderGlowStyles, /prefers-reduced-motion: reduce/);
  assert.match(borderGlowExports, /BorderGlow/);
});

test("homepage and public pricing cards use BorderGlow instead of MagicBento", () => {
  for (const source of [homepagePricing, pricingPage]) {
    const pricingBlock = source.slice(source.indexOf("{plans.map"), source.indexOf("All plans"));
    assert.match(source, /from "@\/components\/ui\/BorderGlow"/);
    assert.match(pricingBlock, /<BorderGlow/);
    assert.match(pricingBlock, /recommended=\{plan\.name === "Growth"\}/);
    assert.match(pricingBlock, /min-h-\[/);
    assert.match(pricingBlock, /mt-auto block/);
    assert.doesNotMatch(pricingBlock, /absolute -top|MagicBentoGrid|MagicBentoCard/);
  }
});

test("pricing values, plan names, badges, and payment routes remain consistent", () => {
  for (const source of [homepagePricing, pricingPage]) {
    for (const expected of ["Starter", "Founder", "Growth", "Scale", "Most Popular"]) {
      assert.match(source, new RegExp(expected));
    }
    assert.match(source, /Starter upgrade/);
    assert.match(source, /\/payment\?plan=founder/);
    assert.match(source, /\/payment\?plan=growth/);
    assert.match(source, /\/payment\?plan=scale/);
    assert.doesNotMatch(source, /\/payment\?plan=(founder|growth|scale)&billing=monthly/);
  }
});
