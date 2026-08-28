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

test("homepage pricing cards use BorderGlow while public pricing page stays static", () => {
  const homepagePricingBlock = homepagePricing.slice(homepagePricing.indexOf("{plans.map"), homepagePricing.indexOf("All plans"));
  assert.match(homepagePricing, /from "@\/components\/ui\/BorderGlow"/);
  assert.match(homepagePricingBlock, /<BorderGlow/);
  assert.match(homepagePricingBlock, /recommended=\{plan\.name === "Growth"\}/);
  assert.match(homepagePricingBlock, /min-h-\[/);
  assert.match(homepagePricingBlock, /mt-auto block/);
  assert.doesNotMatch(homepagePricingBlock, /absolute -top|MagicBentoGrid|MagicBentoCard/);

  assert.match(pricingPage, /PricingPage\.module\.css/);
  assert.match(pricingPage, /styles\.pricingGrid/);
  assert.doesNotMatch(pricingPage, /BorderGlow|AnimatedSection|StaggerItem|framer-motion|MagicBento|canvas|WebGL|Lightfall|Galaxy/);
});

test("pricing values, plan names, badges, and payment routes remain consistent", () => {
  for (const source of [homepagePricing, pricingPage]) {
    for (const expected of ["Starter", "Founder", "Growth", "Scale"]) {
      assert.match(source, new RegExp(expected));
    }
    assert.match(source, /\/payment\?plan=founder/);
    assert.match(source, /\/payment\?plan=growth/);
    assert.match(source, /\/payment\?plan=scale/);
    assert.doesNotMatch(source, /\/payment\?plan=(founder|growth|scale)&billing=monthly/);
  }
  assert.match(homepagePricing, /Most Popular/);
  assert.match(homepagePricing, /Starter upgrade/);
  assert.match(pricingPage, /\$5\/month/);
  assert.match(pricingPage, /\$49\/year/);
  assert.match(pricingPage, /\$10\/month/);
  assert.match(pricingPage, /\$99\/year/);
  assert.match(pricingPage, /\$15\/month/);
  assert.match(pricingPage, /\$149\/year/);
  assert.match(pricingPage, /Most popular/);
});
