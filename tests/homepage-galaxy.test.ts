import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
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

test("homepage renders one Galaxy canvas stage only after the Lightfall hero", () => {
  assert.match(page, /import Galaxy from "@\/components\/marketing\/Galaxy"/);
  assert.match(page, /<HeroSection \/>\s*<div className="homepage-galaxy-stage">/);
  assert.equal((page.match(/<Galaxy/g) ?? []).length, 1, "homepage should render exactly one Galaxy component");
  assert.match(page, /<Galaxy[\s\S]+<div className="homepage-galaxy-content">[\s\S]+<ProductScrollStackSection \/>/);
  assert.match(page, /<CTASection \/>\s*<Footer \/>/);
});

test("Galaxy implementation uses the supplied OGL shader approach with cleanup and accessibility safeguards", () => {
  assert.ok(packageJson.dependencies.ogl, "Galaxy should reuse the existing ogl dependency");
  assert.match(galaxy, /"use client"/);
  assert.match(galaxy, /import \{ Mesh, Program, Renderer, Triangle \} from "ogl"/);
  assert.match(galaxy, /const fragmentShader = `/);
  assert.match(galaxy, /uMouseRepulsion/);
  assert.match(galaxy, /uAutoCenterRepulsion/);
  assert.match(galaxy, /ResizeObserver/);
  assert.match(galaxy, /IntersectionObserver/);
  assert.match(galaxy, /prefers-reduced-motion: reduce/);
  assert.match(galaxy, /cancelAnimationFrame/);
  assert.match(galaxy, /container\.removeChild\(canvas\)/);
  assert.match(galaxy, /WEBGL_lose_context/);
  assert.match(galaxy, /aria-hidden="true"/);
  assert.match(galaxy, /role="presentation"/);
});

test("Galaxy background continues behind all post-hero homepage sections and footer", () => {
  const postHeroOrder = [
    "ProductScrollStackSection",
    "RealWorkflowSection",
    "EvidenceEntrySection",
    "LogoMarquee",
    "DifferentiationSection",
    "RecurringEvidenceSection",
    "HowItWorksSection",
    "CapabilitiesSection",
    "ComparisonSection",
    "TrustSection",
    "TestimonialsSection",
    "PricingSection",
    "CTASection",
    "Footer",
  ];

  const stage = page.slice(page.indexOf('className="homepage-galaxy-stage"'));
  let last = -1;
  for (const component of postHeroOrder) {
    const index = stage.indexOf(`<${component} />`);
    assert.ok(index > last, `${component} should remain inside the continuous Galaxy stage`);
    last = index;
  }
});

test("Galaxy styling replaces post-hero section backgrounds without affecting the hero", () => {
  assert.match(galaxyCss, /\.homepage-galaxy-stage/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage \.editorial-section[\s\S]+background: transparent !important/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage section\.border-y[\s\S]+background: rgba\(3, 6, 14, 0\.56\) !important/);
  assert.match(galaxyCss, /\.homepage-galaxy-stage footer[\s\S]+background: rgba\(3, 6, 14, 0\.72\) !important/);
  assert.match(galaxyCss, /\.homepage-galaxy-content[\s\S]+z-index: 2/);
  assert.equal(galaxyCss.includes("lightfall-hero"), false, "Galaxy CSS should not change the Lightfall hero");
});

test("Galaxy is homepage-only and does not enter app, auth, API, or marketing route pages", () => {
  const files = walk(join(root, "src")).filter((file) => /\.(tsx|ts)$/.test(file));
  const allowed = new Set([
    join(root, "src/app/page.tsx"),
    join(root, "src/components/marketing/Galaxy.tsx"),
  ]);

  for (const file of files) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("Galaxy"), false, `${file} should not import or render Galaxy`);
  }
});
