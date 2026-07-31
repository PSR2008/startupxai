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
const homepage = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const marketing = readFileSync(join(root, "src/components/marketing/EnginesSection.tsx"), "utf8");
const dashboard = readFileSync(join(root, "src/app/(app)/dashboard/page.tsx"), "utf8");
const pricingPage = readFileSync(join(root, "src/app/(marketing)/pricing/page.tsx"), "utf8");
const methodologyPage = readFileSync(join(root, "src/app/(marketing)/methodology/page.tsx"), "utf8");
const supportPage = readFileSync(join(root, "src/app/(marketing)/support/page.tsx"), "utf8");
const evidenceEngine = readFileSync(join(root, "src/app/(app)/evidence-engine/page.tsx"), "utf8");
const founderDecision = readFileSync(join(root, "src/app/(app)/founder-decision/page.tsx"), "utf8");
const recentReports = readFileSync(join(root, "src/components/app/RecentReports.tsx"), "utf8");

test("MagicBento installs GSAP and exposes reusable components without demo card data", () => {
  assert.ok(packageJson.dependencies.gsap, "gsap dependency should be installed for MagicBento interactions");
  assert.match(exportsFile, /MagicBentoGrid/);
  assert.match(exportsFile, /MagicBentoCard/);
  assert.match(exportsFile, /MagicBentoSpotlight/);
  assert.equal(/cardData/.test(`${grid}\n${card}\n${spotlight}`), false, "implementation should not copy demo cardData");
});

test("EnginesSection render status is explicit and unused grids are not counted as live integration", () => {
  assert.match(homepage, /<EvidenceEntrySection \/>/);
  assert.match(homepage, /<PricingSection \/>/);
  assert.equal(homepage.includes("<EnginesSection />"), false, "homepage should not restore the old engines grid");
  assert.match(marketing, /export function EnginesSection\(\)/);
});

test("MagicBento spotlight is scoped to its grid and does not create body-level global card scans", () => {
  assert.match(spotlight, /gridRef\.current/);
  assert.match(spotlight, /querySelectorAll<HTMLElement>\("\.magic-bento-card"\)/);
  assert.equal(/document\.querySelectorAll\("\.magic-bento-card"\)/.test(spotlight), false);
  assert.equal(/document\.body\.appendChild/.test(spotlight), false);
  assert.equal(/document\.addEventListener\("mousemove"/.test(spotlight), false);
  assert.match(spotlight, /grid\.addEventListener\("mousemove"/);
  assert.match(grid, /IntersectionObserver/);
  assert.match(spotlight, /gsap\.killTweensOf\(spotlight\)/);
});

test("MagicBento card supports optional premium effects and motion safeguards", () => {
  for (const prop of ["enableStars", "enableTilt", "enableMagnetism", "clickEffect", "particleCount"]) {
    assert.match(card, new RegExp(prop));
  }
  assert.match(card, /prefers-reduced-motion: reduce/);
  assert.match(card, /max-width: 767px/);
  assert.match(card, /maxTilt = 2/);
  assert.match(card, /magnetismStrength = 3/);
  assert.match(card, /removeEventListener/);
  assert.match(card, /window\.clearTimeout/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /magic-bento-card--border-glow::after/);
  assert.match(styles, /magic-bento-ripple/);
  assert.match(styles, /magic-bento-card:focus-visible/);
});

test("homepage live static grids use MagicBento while hero and ScrollStack stay clean", () => {
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"/);
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 md:grid-cols-3 gap-5"/);
  assert.match(marketing, /<MagicBentoGrid className="grid grid-cols-1 sm:grid-cols-2 gap-4"/);
  assert.doesNotMatch(marketing, /enableStars|particleCount=\{6\}/);
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

test("MagicBento suspends hover motion and particles during homepage scroll", () => {
  assert.match(card, /homepage-is-scrolling/);
  assert.match(card, /startupx:homepage-scroll-start/);
  assert.match(card, /resetCardTransform/);
  assert.match(card, /if \(!enableStars \|\| isHomepageScrolling\(\)\)/);
  assert.match(spotlight, /homepage-is-scrolling/);
  assert.match(spotlight, /startupx:homepage-scroll-start/);
  assert.match(spotlight, /handleHomepageScrollStart/);
  assert.match(styles, /html\.homepage-is-scrolling \.magic-bento-spotlight/);
  assert.match(styles, /html\.homepage-is-scrolling \.magic-bento-card/);
});

test("pricing no longer combines MagicBento with pricing card interactions", () => {
  for (const source of [marketing, pricingPage]) {
    const pricingSection = source.slice(source.indexOf("{plans.map"), source.indexOf("All plans"));
    assert.equal(pricingSection.includes("MagicBentoGrid"), false);
    assert.equal(pricingSection.includes("MagicBentoCard"), false);
    assert.equal(/<MagicBentoCard[^>]+href=\{plan\.href\}/.test(source), false);
  }
});

test("methodology and support compact cards use MagicBento while long copy and form sections stay static", () => {
  assert.match(methodologyPage, /principles\.map[\s\S]+<MagicBentoCard/);
  assert.match(methodologyPage, /labels\.map[\s\S]+<MagicBentoCard/);
  assert.equal(/implementedModel\.map[\s\S]+MagicBentoCard/.test(methodologyPage), false);

  assert.match(supportPage, /supportChannels\.map[\s\S]+<MagicBentoCard/);
  const supportForm = supportPage.slice(supportPage.indexOf("{submitted ?"), supportPage.indexOf("</AnimatedSection>"));
  assert.equal(supportForm.includes("MagicBento"), false, "support form should remain static");
});

test("Evidence Engine top and action cards use App preset while records, scores and provenance stay static", () => {
  assert.match(evidenceEngine, /<MagicBentoGrid className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4" preset="app"/);
  assert.match(evidenceEngine, /function ManualEntry[\s\S]+<MagicBentoCard/);
  const evidenceRecordBlock = evidenceEngine.slice(
    evidenceEngine.indexOf("result.evidenceItems.map"),
    evidenceEngine.indexOf("<section className=\"surface-panel w-full max-w-full p-5\">", evidenceEngine.indexOf("result.evidenceItems.map")),
  );
  assert.equal(evidenceRecordBlock.includes("MagicBento"), false);
  const scorePanelBlock = evidenceEngine.slice(
    evidenceEngine.indexOf("function ScorePanel"),
    evidenceEngine.indexOf("function ManualEntry"),
  );
  assert.equal(scorePanelBlock.includes("MagicBento"), false);
  const provenanceBlock = evidenceEngine.slice(
    evidenceEngine.indexOf("function EvidenceProvenanceList"),
    evidenceEngine.indexOf("function RecommendedTestsList"),
  );
  assert.equal(provenanceBlock.includes("MagicBentoCard"), false);
  assert.equal(evidenceEngine.includes("enableStars"), false);
});

test("Founder Decision intro and action cards use restrained MagicBento while long content stays static", () => {
  assert.match(founderDecision, /<MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app"/);
  assert.match(founderDecision, /function ActionCard[\s\S]+<MagicBentoCard/);
  const strategicBlock = founderDecision.slice(
    founderDecision.indexOf("Strategic interpretation"),
    founderDecision.indexOf("<ActionCard title=\"Primary action - next 48 hours\""),
  );
  assert.equal(strategicBlock.includes("MagicBentoCard"), false);
  const limitationsBlock = founderDecision.slice(
    founderDecision.indexOf("DECISION_LIMITATION"),
    founderDecision.indexOf("{priorities.length > 0"),
  );
  assert.equal(limitationsBlock.includes("MagicBentoCard"), false);
  assert.equal(founderDecision.includes("enableStars"), false);
  assert.equal(founderDecision.includes("enableTilt"), false);
});

test("assessment tool introductions use App preset and forms/results stay static", () => {
  const toolFiles = [
    "src/app/(app)/idea-engine/page.tsx",
    "src/app/(app)/revenue-engine/page.tsx",
    "src/app/(app)/user-psychology/page.tsx",
    "src/app/(app)/growth-engine/page.tsx",
    "src/app/(app)/competitor-intelligence/page.tsx",
    "src/app/(app)/cold-dm/page.tsx",
    "src/app/(app)/brand-forge/page.tsx",
  ];

  for (const file of toolFiles) {
    const source = readFileSync(join(root, file), "utf8");
    assert.match(source, /<MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app"/, `${file} should wrap only intro cards`);
    assert.equal(/<MagicBentoCard[\s\S]{0,260}<Input /.test(source), false, `${file} form inputs should not be inside MagicBento cards`);
    assert.equal(source.includes("enableStars"), false, `${file} should not use particles`);
  }
});

test("report index cards may use MagicBento but report bodies and exports remain static", () => {
  assert.match(recentReports, /reports\.map[\s\S]+<MagicBentoCard/);
  for (const file of [
    "src/components/app/ReportRenderer.tsx",
    "src/app/(app)/reports/[id]/page.tsx",
    "src/app/share/[token]/page.tsx",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.includes("MagicBento"), false, `${file} should remain static`);
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
    "src/app/(app)/profile/page.tsx",
    "src/app/(app)/payment/page.tsx",
    "src/app/(auth)/signin/page.tsx",
    "src/app/(auth)/signup/page.tsx",
  ];

  for (const file of protectedFiles) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.includes("MagicBento"), false, `${file} should not import or use MagicBento`);
  }
});
