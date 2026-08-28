import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const waitlisty = readFileSync(join(root, "src/components/marketing/waitlisty/WaitlistyHomepage.tsx"), "utf8");
const waitlistyCss = readFileSync(join(root, "src/components/marketing/waitlisty/WaitlistyHomepage.module.css"), "utf8");
const galaxy = readFileSync(join(root, "src/components/marketing/Galaxy.tsx"), "utf8");
const galaxyCss = readFileSync(join(root, "src/components/marketing/Galaxy.css"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

const walk = (dir: string): string[] => {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

test("homepage renders the lightweight Waitlisty foundation without Galaxy or Lightfall", () => {
  assert.match(page, /import WaitlistyHomepage from "@\/components\/marketing\/waitlisty"/);
  assert.match(page, /return <WaitlistyHomepage \/>/);
  assert.doesNotMatch(page, /import Galaxy|<Galaxy|HeroSection|Lightfall|ProductScrollStackSection|homepage-galaxy-stage/);
  assert.doesNotMatch(page, /HomepageScrollState|homepage-is-scrolling|startupx:homepage-scroll/);
  assert.match(waitlisty, /AI co-founder for startup validation/);
  assert.match(waitlisty, /Validate startup ideas before you waste months building/);
  assert.doesNotMatch(waitlisty, /<h1[^>]*>\s*StartupX AI\s*<\/h1>|styles\.orb|Scroll down/);
});

test("Galaxy implementation uses the supplied OGL shader approach with cleanup and accessibility safeguards", () => {
  assert.ok(packageJson.dependencies.ogl, "Galaxy should reuse the existing ogl dependency");
  assert.match(galaxy, /"use client"/);
  assert.match(galaxy, /import \{ Mesh, Program, Renderer, Triangle \} from "ogl"/);
  assert.match(galaxy, /const fragmentShader = `/);
  assert.match(galaxy, /uMouseRepulsion/);
  assert.match(galaxy, /uAutoCenterRepulsion/);
  assert.match(galaxy, /ResizeObserver/);
  assert.match(galaxy, /max-width: 768px\), \(pointer: coarse/);
  assert.match(galaxy, /container\.removeChild\(canvas\)/);
  assert.match(galaxy, /WEBGL_lose_context/);
  assert.match(galaxy, /aria-hidden="true"/);
  assert.match(galaxy, /role="presentation"/);
});

test("Waitlisty homepage keeps StartupX AI content and real conversion routes", () => {
  for (const phrase of [
    "Market demand",
    "Competitor gaps",
    "Pricing strategy",
    "User psychology",
    "Risk analysis",
    "Growth plan",
    "Run your first startup assessment",
    "structured validation report",
  ]) {
    assert.match(waitlisty, new RegExp(phrase));
  }

  for (const href of [
    '"/signup"',
    '"/pricing"',
    '"/payment?plan=founder"',
    '"/payment?plan=growth"',
    '"/payment?plan=scale"',
  ]) {
    assert.match(waitlisty, new RegExp(href.replace("?", "\\?")));
  }
});

test("Galaxy styling replaces post-hero section backgrounds without affecting the hero", () => {
  assert.match(galaxyCss, /\.homepage-galaxy-stage/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage \.editorial-section[\s\S]+background: transparent !important/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage section\.border-y[\s\S]+background: rgba\(3, 6, 14, 0\.56\) !important/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage \.homepage-footer[\s\S]+linear-gradient/);
  assert.match(galaxyCss, /\.homepage-galaxy-content[\s\S]+z-index: 2/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage > \.homepage-galaxy-canvas[\s\S]+position: sticky/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage > \.homepage-galaxy-canvas[\s\S]+height: 100svh/);
  assert.doesNotMatch(galaxyCss, /backdrop-filter/);
  assert.equal(galaxyCss.includes("lightfall-hero"), false, "Galaxy CSS should not change the Lightfall hero");
});

test("Waitlisty homepage uses content-driven sections and a compact footer", () => {
  assert.match(waitlisty, /<footer className=\{styles\.footer\}>/);
  const footerCss = waitlistyCss.slice(waitlistyCss.indexOf(".footer {"), waitlistyCss.indexOf(".footerRow {"));
  assert.match(footerCss, /padding: 22px 0 0/);
  assert.doesNotMatch(footerCss, /min-height:\s*100vh|height:\s*100vh|100dvh|position:\s*fixed/);
  assert.doesNotMatch(waitlisty, /href="\/terms"|href="#"/);
});

test("homepage replacement avoids continuous animation and WebGL loops", () => {
  assert.doesNotMatch(waitlisty, /requestAnimationFrame|cancelAnimationFrame|IntersectionObserver|ResizeObserver|addEventListener\("scroll"|pointermove|canvas|WebGL|ogl|framer-motion|motion\./);
  assert.doesNotMatch(waitlistyCss, /animation:|@keyframes|will-change|backdrop-filter:\s*blur\([^)]{3,}/);
  assert.match(galaxy, /renderStaticFrame/);
  assert.match(galaxy, /uTime: \{ value: 4\.25 \}/);
  assert.match(galaxy, /uniforms\.uTime\.value = 4\.25/);
  assert.match(galaxy, /uniforms\.uSpeed\.value = 0/);
  assert.match(galaxy, /uniforms\.uTwinkleIntensity\.value = 0/);
  assert.match(galaxy, /uniforms\.uRotationSpeed\.value = 0/);
  assert.match(galaxy, /mobileMedia\.matches \? 1 : 1\.25/);
  assert.match(galaxy, /antialias: false/);
  assert.match(galaxy, /powerPreference: "low-power"/);
  assert.doesNotMatch(galaxy, /requestAnimationFrame|cancelAnimationFrame|IntersectionObserver|addEventListener\("scroll"|pointermove|pageIsScrolling|scheduleNextFrame/);
});

test("Galaxy is homepage-only and does not enter app, auth, API, or marketing route pages", () => {
  const files = walk(join(root, "src")).filter((file) => /\.(tsx|ts)$/.test(file));
  const allowed = new Set([
    join(root, "src/components/marketing/Galaxy.tsx"),
  ]);

  for (const file of files) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("Galaxy"), false, `${file} should not import or render Galaxy`);
  }
});
