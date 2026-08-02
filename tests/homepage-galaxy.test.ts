import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
const footer = readFileSync(join(root, "src/components/marketing/Footer.tsx"), "utf8");
const engines = readFileSync(join(root, "src/components/marketing/EnginesSection.tsx"), "utf8");
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
  assert.doesNotMatch(page, /HomepageScrollState|homepage-is-scrolling|startupx:homepage-scroll/);
  assert.equal((page.match(/<Galaxy/g) ?? []).length, 1, "homepage should render exactly one Galaxy component");
  assert.match(page, /<Galaxy[\s\S]+<div className="homepage-galaxy-content">[\s\S]+<ProductScrollStackSection \/>/);
  assert.match(page, /<CTASection \/>\s*<Footer variant="homepage" \/>/);
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
    const index = component === "Footer" ? stage.indexOf('<Footer variant="homepage" />') : stage.indexOf(`<${component} />`);
    assert.ok(index > last, `${component} should remain inside the continuous Galaxy stage`);
    last = index;
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

test("homepage footer uses compact editorial spacing without full-section sizing", () => {
  assert.match(footer, /variant\?: "default" \| "homepage"/);
  assert.match(footer, /homepage-footer/);
  assert.match(footer, /homepageFooterLinks/);
  assert.match(footer, /const linkGroups = isHomepage \? homepageFooterLinks : footerLinks/);
  assert.match(footer, /container-custom pt-7 pb-7/);
  assert.match(footer, /md:grid-cols-\[1\.15fr_repeat\(4,minmax\(0,0\.72fr\)\)\]/);
  assert.match(footer, /space-y-1\.5/);
  assert.match(footer, /All systems operational/);
  assert.match(footer, /&copy; \{new Date\(\)\.getFullYear\(\)\}/);
  assert.doesNotMatch(footer, /href:\s*"#"/);
  assert.doesNotMatch(footer, /pt-\[52px\]|py-16"\s*:\s*"container-custom|min-h-screen|min-height:\s*100vh|min-h-\[100vh\]|h-screen/);
  assert.match(engines, /homepage-final-cta[\s\S]+pt-24 pb-8/);
  assert.doesNotMatch(engines, /homepage-final-cta[\s\S]+py-24/);
});

test("Galaxy renders one deterministic static frame and does not install animation or scroll loops", () => {
  assert.match(page, /starSpeed=\{0\.28\}/);
  assert.match(page, /density=\{0\.85\}/);
  assert.match(page, /speed=\{0\.45\}/);
  assert.match(page, /glowIntensity=\{0\.22\}/);
  assert.match(page, /saturation=\{0\.5\}/);
  assert.match(page, /twinkleIntensity=\{0\.1\}/);
  assert.match(page, /rotationSpeed=\{0\.012\}/);
  assert.match(page, /mouseInteraction=\{false\}/);
  assert.match(page, /mouseRepulsion=\{false\}/);
  assert.match(page, /transparent=\{true\}/);
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
    join(root, "src/app/page.tsx"),
    join(root, "src/components/marketing/Galaxy.tsx"),
  ]);

  for (const file of files) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("Galaxy"), false, `${file} should not import or render Galaxy`);
  }
});
