import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};
const grid = readFileSync(join(root, "src/components/ui/MagicBento/MagicBentoGrid.tsx"), "utf8");
const card = readFileSync(join(root, "src/components/ui/MagicBento/MagicBentoCard.tsx"), "utf8");
const spotlight = readFileSync(join(root, "src/components/ui/MagicBento/MagicBentoSpotlight.tsx"), "utf8");
const styles = readFileSync(join(root, "src/components/ui/MagicBento/MagicBento.css"), "utf8");
const exportsFile = readFileSync(join(root, "src/components/ui/MagicBento/index.ts"), "utf8");
const marketing = readFileSync(join(root, "src/components/marketing/EnginesSection.tsx"), "utf8");
const dashboard = readFileSync(join(root, "src/app/(app)/dashboard/page.tsx"), "utf8");

test("MagicBento installs GSAP and exposes reusable components without demo card data", () => {
  assert.ok(packageJson.dependencies.gsap, "gsap dependency should be installed for MagicBento interactions");
  assert.match(exportsFile, /MagicBentoGrid/);
  assert.match(exportsFile, /MagicBentoCard/);
  assert.match(exportsFile, /MagicBentoSpotlight/);
  assert.equal(/cardData/.test(`${grid}\n${card}\n${spotlight}`), false, "implementation should not copy demo cardData");
});

test("MagicBento spotlight is scoped to its grid and cleans up its fixed layer", () => {
  assert.match(spotlight, /gridRef\.current/);
  assert.match(spotlight, /querySelectorAll<HTMLElement>\("\.magic-bento-card"\)/);
  assert.equal(/document\.querySelectorAll\("\.magic-bento-card"\)/.test(spotlight), false);
  assert.match(spotlight, /document\.body\.appendChild\(spotlight\)/);
  assert.match(spotlight, /spotlight\.remove\(\)/);
  assert.match(spotlight, /gsap\.killTweensOf\(spotlight\)/);
});

test("MagicBento card supports optional premium effects and motion safeguards", () => {
  for (const prop of ["enableStars", "enableTilt", "enableMagnetism", "clickEffect", "particleCount"]) {
    assert.match(card, new RegExp(prop));
  }
  assert.match(card, /prefers-reduced-motion: reduce/);
  assert.match(card, /max-width: 767px/);
  assert.match(card, /removeEventListener/);
  assert.match(card, /window\.clearTimeout/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /magic-bento-card--border-glow::after/);
  assert.match(styles, /magic-bento-ripple/);
});

test("MagicBento is applied only to high-level card grids, not the Lightfall hero or ScrollStack", () => {
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"/);
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16"/);
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 sm:grid-cols-2 gap-4"/);
  assert.match(dashboard, /<MagicBentoGrid className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"/);

  for (const file of [
    "src/components/marketing/HeroSection.tsx",
    "src/components/marketing/ProductScrollStackSection.tsx",
    "src/components/marketing/ScrollStack.tsx",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.includes("MagicBento"), false, `${file} should remain unchanged by MagicBento`);
  }
});

test("MagicBento does not touch protected business logic surfaces", () => {
  const protectedFiles = [
    "src/lib/entitlements.ts",
    "src/lib/evidence-scoring.ts",
    "src/lib/payment-activation.ts",
    "src/lib/subscription.ts",
    "src/app/api/auth/oauth-intent/route.ts",
    "src/app/api/razorpay/create-order/route.ts",
    "src/app/api/razorpay/verify-payment/route.ts",
    "src/app/api/razorpay/webhook/route.ts",
  ];

  for (const file of protectedFiles) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.includes("MagicBento"), false, `${file} should not import or use MagicBento`);
  }
});
