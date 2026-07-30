import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const section = readFileSync(join(root, "src/components/marketing/ProductScrollStackSection.tsx"), "utf8");
const stack = readFileSync(join(root, "src/components/marketing/ScrollStack.tsx"), "utf8");
const stackCss = readFileSync(join(root, "src/components/marketing/ScrollStack.css"), "utf8");
const hero = readFileSync(join(root, "src/components/marketing/HeroSection.tsx"), "utf8");
const navbar = readFileSync(join(root, "src/components/marketing/Navbar.tsx"), "utf8");

test("homepage renders one ScrollStack product introduction after the Lightfall hero", () => {
  assert.match(page, /import ProductScrollStackSection/);
  assert.match(page, /<HeroSection \/>\s*<div className="homepage-galaxy-stage">[\s\S]*<ProductScrollStackSection \/>/);
  assert.doesNotMatch(page, /<EnginesSection \/>/);
  assert.doesNotMatch(page, /<FeaturesSection \/>/);
});

test("ScrollStack includes all 13 cards in the required order", () => {
  const titles = [
    "Evidence Engine",
    "Assumptions",
    "Experiments",
    "Competitor Intelligence",
    "Founder Decisions",
    "Reports",
    "Idea & Market Engine",
    "Revenue Engine",
    "User Psychology",
    "Growth Engine",
    "Founder Decision Engine",
    "ColdDM",
    "BrandForge",
  ];

  let lastIndex = -1;
  for (const title of titles) {
    const index = section.indexOf(`title: "${title}"`);
    assert.ok(index > lastIndex, `${title} should appear after the previous card`);
    lastIndex = index;
  }
});

test("ScrollStack card labels, anchors and real routes are present", () => {
  for (const label of ["Core workflow", "Assessment tool", "Revenue tool"]) {
    assert.match(section, new RegExp(label));
  }

  for (const href of [
    "/evidence-engine",
    "/competitor-intelligence",
    "/founder-decision",
    "/reports",
    "/idea-engine",
    "/revenue-engine",
    "/user-psychology",
    "/growth-engine",
    "/cold-dm",
    "/brand-forge",
  ]) {
    assert.match(section, new RegExp(`href: "${href.replace("/", "\\/")}"`));
  }

  assert.match(section, /markerId: "features"/);
  assert.match(section, /markerId: "assessment-tools"/);
  assert.match(section, /id="engines"/);
});

test("ScrollStack copy avoids invented validation claims and keeps evidence semantics clear", () => {
  const banned = [
    "guaranteed success",
    "are guaranteed acquisition",
    "proves demand",
    "automatic customer data",
    "founder claims are verified evidence",
  ];

  for (const phrase of banned) {
    assert.equal(section.toLowerCase().includes(phrase), false, `Unexpected invented claim: ${phrase}`);
  }

  assert.match(section, /Founder claims and generated suggestions are not treated as verified evidence/);
  assert.match(section, /not verified market truth/);
  assert.match(section, /not proof of demand/);
  assert.match(section, /not guaranteed acquisition paths/);
});

test("ScrollStack implementation scopes card lookup and owns one Lenis lifecycle", () => {
  assert.match(stack, /scroller\.querySelectorAll<HTMLElement>\("\.scroll-stack-card"\)/);
  assert.doesNotMatch(stack, /document\.querySelectorAll\('\.scroll-stack-card'\)/);
  assert.doesNotMatch(stack, /document\.querySelectorAll\("\.scroll-stack-card"\)/);
  assert.equal((stack.match(/new Lenis/g) ?? []).length, 2, "window and non-window paths should be the only Lenis constructors");
  assert.match(stack, /lenisRef\.current\?\.destroy\(\)/);
  assert.match(stack, /cancelAnimationFrame\(animationFrameRef\.current\)/);
  assert.match(stack, /new IntersectionObserver/);
});

test("ScrollStack reduced-motion and mobile render a normal vertical list", () => {
  assert.match(stack, /prefers-reduced-motion: reduce/);
  assert.match(stack, /max-width: 767px/);
  assert.match(stack, /isStaticLayoutRef\.current = reducedMotionMedia\.matches \|\| smallViewportMedia\.matches/);
  assert.match(stackCss, /\.scroll-stack-no-motion \.scroll-stack-card/);
  assert.match(stackCss, /@media \(max-width: 767px\)/);
  assert.match(stackCss, /transform: none !important/);
});

test("Lightfall hero and navbar structure remain in place", () => {
  assert.match(hero, /<Lightfall/);
  assert.match(hero, /backgroundColor="#0A29FF"/);
  assert.match(hero, /colors=\{LIGHTFALL_COLORS\}/);
  assert.match(navbar, /const navLinks = \[/);
  assert.match(navbar, /Features/);
  assert.match(navbar, /Assessment tools/);
  assert.match(navbar, /Pricing/);
});

test("ScrollStack integration does not touch protected app behavior surfaces", () => {
  const changedSurfaceText = [page, section, stack, stackCss].join("\n");
  for (const phrase of [
    "razorpay",
    "exchangeCodeForSession",
    "createServerClient",
    "service_role",
    "calculateEvidenceScores",
    "anthropic",
  ]) {
    assert.equal(changedSurfaceText.toLowerCase().includes(phrase.toLowerCase()), false);
  }
});
