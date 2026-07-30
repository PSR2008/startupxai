import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const heroPath = join(root, "src/components/marketing/HeroSection.tsx");
const lightfallPath = join(root, "src/components/marketing/Lightfall.tsx");
const globalsPath = join(root, "src/app/globals.css");

test("homepage hero uses Lightfall as the only hero background artwork", () => {
  const hero = readFileSync(heroPath, "utf8");
  const globals = readFileSync(globalsPath, "utf8");

  assert.match(hero, /import Lightfall from "\.\/Lightfall"/);
  assert.match(hero, /<Lightfall/);
  assert.match(hero, /className="lightfall-hero-bg"/);
  assert.doesNotMatch(hero, /resadex-liquid-field|resadex-ring|resadex-center-bead/);
  assert.doesNotMatch(globals, /\.resadex-liquid-field|\.resadex-ring|\.resadex-center-bead/);
  assert.doesNotMatch(globals, /resadex-ripple-drift|resadex-bead-spin/);
});

test("Lightfall receives the requested production hero props", () => {
  const hero = readFileSync(heroPath, "utf8");

  for (const color of ["#A6C8FF", "#5227FF", "#FF9FFC"]) {
    assert.match(hero, new RegExp(color.replace("#", "#")));
  }
  for (const prop of [
    'backgroundColor="#0A29FF"',
    "speed={1}",
    "streakCount={8}",
    "streakWidth={1}",
    "streakLength={1}",
    "glow={1}",
    "density={1}",
    "twinkle={1}",
    "zoom={2}",
    "backgroundGlow={1}",
    "opacity={1}",
    "mouseInteraction={true}",
    "mouseStrength={1}",
    "mouseRadius={0.6}",
  ]) {
    assert.ok(hero.includes(prop), `Missing Lightfall prop ${prop}`);
  }
});

test("Lightfall canvas is decorative, bounded, and cleanup-safe", () => {
  const source = readFileSync(lightfallPath, "utf8");
  const css = readFileSync(join(root, "src/components/marketing/Lightfall.css"), "utf8");

  assert.match(source, /new Renderer\(/);
  assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /pointerListenerAttached/);
  assert.match(source, /removeEventListener\("pointermove"/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /container\.removeChild\(canvas\)/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /role="presentation"/);
  assert.match(source, /canvas\.tabIndex = -1/);
  assert.match(css, /overflow: hidden/);
});

test("hero keeps approved copy and CTA routes above the WebGL layer", () => {
  const hero = readFileSync(heroPath, "utf8");
  const globals = readFileSync(globalsPath, "utf8");

  assert.match(hero, /Evidence-backed founder workspace/);
  assert.match(hero, /STARTUPX/);
  assert.match(hero, /Add evidence from customer interviews, research and experiments/);
  assert.match(hero, /href="\/signup\?next=\/evidence-engine"/);
  assert.match(hero, /href="\/#workflow"/);
  assert.match(hero, /relative z-10/);
  assert.match(globals, /\.lightfall-hero-bg[\s\S]*z-index:0/);
  assert.match(globals, /\.lightfall-hero-scrim[\s\S]*z-index:1/);
  assert.match(globals, /\.resadex-copy[\s\S]*z-index:3/);
});

test("homepage hero readability uses transparent overlays without changing Lightfall", () => {
  const hero = readFileSync(heroPath, "utf8");
  const globals = readFileSync(globalsPath, "utf8");

  assert.match(globals, /\.lightfall-hero-scrim[\s\S]*radial-gradient\(ellipse at 50% 70%/);
  assert.match(globals, /\.resadex-copy::before/);
  assert.match(globals, /\.resadex-copy::before[\s\S]*radial-gradient\(ellipse at center,rgba\(0,0,0,0\.58\)/);
  assert.match(globals, /\.resadex-title[\s\S]*color:#fff/);
  assert.match(globals, /\.resadex-title[\s\S]*-webkit-text-fill-color:#fff/);
  assert.match(globals, /\.resadex-title[\s\S]*text-shadow:0 3px 18px rgba\(0,0,0,0\.55\)/);
  assert.match(globals, /\.resadex-subtitle[\s\S]*color:rgba\(255,255,255,0\.88\)/);
  assert.match(hero, /backgroundColor="#0A29FF"/);
  assert.match(hero, /colors=\{LIGHTFALL_COLORS\}/);
});

test("homepage navbar uses a dark translucent readability surface over Lightfall", () => {
  const navbar = readFileSync(join(root, "src/components/marketing/Navbar.tsx"), "utf8");

  assert.match(navbar, /useLightNavText = isHomePage \|\| isDarkNav/);
  assert.match(navbar, /bg-\[rgba\(8,10,30,0\.58\)\]/);
  assert.match(navbar, /border-white\/\[0\.22\]/);
  assert.match(navbar, /backdrop-blur-\[18px\]/);
  assert.match(navbar, /text-white\/\[0\.78\]/);
  assert.match(navbar, /hover:text-white/);
});
