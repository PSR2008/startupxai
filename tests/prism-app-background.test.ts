import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const appLayout = readFileSync(join(root, "src/app/(app)/layout.tsx"), "utf8");
const prism = readFileSync(join(root, "src/components/app-background/Prism.tsx"), "utf8");
const prismCss = readFileSync(join(root, "src/components/app-background/Prism.css"), "utf8");
const prismExports = readFileSync(join(root, "src/components/app-background/index.ts"), "utf8");
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

test("Prism uses the supplied OGL shader basis as a reusable client component", () => {
  assert.ok(packageJson.dependencies.ogl, "Prism should reuse the existing ogl dependency");
  assert.match(prism, /"use client"/);
  assert.match(prism, /import \{ Mesh, Program, Renderer, Triangle \} from "ogl"/);
  assert.match(prism, /export interface PrismProps/);
  assert.match(prism, /type AnimationType = "rotate" \| "hover" \| "3drotate"/);
  assert.match(prism, /sdPyramidUpInv/);
  assert.match(prism, /hueRotation/);
  assert.match(prism, /uUseBaseWobble/);
  assert.match(prism, /uTimeScale/);
  assert.match(prism, /ResizeObserver/);
  assert.match(prism, /renderStaticFrame/);
  assert.match(prism, /WEBGL_lose_context/);
  assert.match(prismExports, /AuthenticatedPrismBackground/);
  assert.match(prismExports, /PrismProps/);
});

test("authenticated app layout mounts exactly one shared Prism background behind content", () => {
  assert.match(appLayout, /import \{ AuthenticatedPrismBackground \} from "@\/components\/app-background"/);
  assert.equal((appLayout.match(/<AuthenticatedPrismBackground \/>/g) ?? []).length, 1);
  assert.match(appLayout, /<AuthGate>[\s\S]+<div className="sx-app-shell flex min-h-screen">/);
  assert.match(appLayout, /<AuthenticatedPrismBackground \/>[\s\S]+sx-app-shell__content/);
  assert.match(appLayout, /<AppTopbar \/>[\s\S]+<main className="flex-1 overflow-auto">/);
});

test("Prism is fixed, pointer-transparent, decorative, and layered below app content", () => {
  assert.match(prismCss, /\.sx-app-prism-background[\s\S]+position: fixed/);
  assert.match(prismCss, /\.sx-app-prism-background[\s\S]+inset: 0/);
  assert.match(prismCss, /\.sx-app-prism-background[\s\S]+z-index: 0/);
  assert.match(prismCss, /\.sx-app-prism-background[\s\S]+pointer-events: none/);
  assert.match(prismCss, /\.sx-app-shell[\s\S]+isolation: isolate/);
  assert.match(prismCss, /\.sx-app-shell__content[\s\S]+z-index: 1/);
  assert.match(prismCss, /\.prism-container canvas[\s\S]+pointer-events: none/);
  assert.match(prism, /aria-hidden="true"/);
  assert.match(prism, /role="presentation"/);
});

test("Prism renders a static frame with mobile performance constraints and no idle RAF", () => {
  assert.match(prism, /max-width: 768px\), \(pointer: coarse/);
  assert.match(prism, /mobile \? 1 : 1\.25|isMobile \? 1 : 1\.25/);
  assert.match(prism, /powerPreference: "low-power"/);
  assert.match(prism, /antialias: false/);
  assert.match(prism, /iTime: \{ value: 4\.25 \}/);
  assert.match(prism, /uniforms\.iTime\.value = 4\.25/);
  assert.match(prism, /uniforms\.uUseBaseWobble\.value = 0/);
  assert.match(prism, /uniforms\.uTimeScale\.value = 0/);
  assert.doesNotMatch(prism, /requestAnimationFrame|cancelAnimationFrame|IntersectionObserver|addEventListener\("scroll"|pointermove|onVisibilityChange/);
  assert.match(prismCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(prismCss, /@media \(max-width: 767px\)/);
});

test("Prism is excluded from payment checkout and not added to public route layouts", () => {
  assert.match(prism, /usePathname/);
  assert.match(prism, /pathname\?\.startsWith\("\/payment"\)/);
  assert.match(prism, /return null/);

  const sourceFiles = walk(join(root, "src/app")).filter((file) => /\.(tsx|ts)$/.test(file));
  const allowed = new Set([join(root, "src/app/(app)/layout.tsx")]);
  for (const file of sourceFiles) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("AuthenticatedPrismBackground"), false, `${file} should not render the app Prism background`);
    assert.equal(source.includes("app-background"), false, `${file} should not import the app Prism background`);
  }
});

test("Prism does not modify protected product, auth, payment, API, or marketing systems", () => {
  const files = walk(join(root, "src")).filter((file) => /\.(tsx|ts)$/.test(file));
  const allowed = new Set([
    join(root, "src/app/(app)/layout.tsx"),
    join(root, "src/components/app-background/Prism.tsx"),
    join(root, "src/components/app-background/index.ts"),
  ]);

  for (const file of files) {
    if (allowed.has(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("Prism"), false, `${file} should not be changed to know about Prism`);
  }
});
