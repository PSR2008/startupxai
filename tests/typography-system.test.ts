import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const tailwind = readFileSync(join(root, "tailwind.config.ts"), "utf8");
const navbar = readFileSync(join(root, "src/components/marketing/Navbar.tsx"), "utf8");
const staggeredMenuCss = readFileSync(join(root, "src/components/app-navigation/StaggeredAppMenu.css"), "utf8");
const hero = readFileSync(join(root, "src/components/marketing/HeroSection.tsx"), "utf8");
const marketingSections = readFileSync(join(root, "src/components/marketing/EnginesSection.tsx"), "utf8");

const walk = (dir: string): string[] => {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

test("root font loading uses the editorial Newsreader, IBM Plex Sans and IBM Plex Mono system", () => {
  assert.match(layout, /IBM_Plex_Sans/);
  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /Newsreader/);
  assert.match(layout, /variable: "--font-body"/);
  assert.match(layout, /variable: "--font-display"/);
  assert.match(layout, /variable: "--font-mono"/);
  assert.doesNotMatch(layout, /Space_Grotesk|localFont|SecretSolver|font-horror/);

  assert.match(globals, /--font-display: "Newsreader", ui-serif, Georgia, serif/);
  assert.match(globals, /--font-body: "IBM Plex Sans"/);
  assert.match(globals, /--font-mono: "IBM Plex Mono"/);
  assert.match(tailwind, /display: \["var\(--font-display\)", "ui-serif", "Georgia", "serif"\]/);
  assert.match(tailwind, /bricolage: \["var\(--font-body\)"/);
});

test("marketing display surfaces use Newsreader while navigation and app menu stay on IBM Plex Sans", () => {
  assert.match(hero, /className="resadex-title"/);
  assert.match(globals, /\.resadex-title[\s\S]+font-family:var\(--font-display\)/);
  assert.match(marketingSections, /<h2 className="[^"]*font-display/);
  assert.match(navbar, /font-\[var\(--font-body\)\]/);
  assert.doesNotMatch(navbar, /font-\[var\(--font-display\)\]/);
  assert.match(staggeredMenuCss, /\.staggered-app-menu__brand p[\s\S]+font-family: var\(--font-body\)/);
  assert.match(staggeredMenuCss, /\.staggered-app-menu__item[\s\S]+font-family: var\(--font-body\)/);
});

test("legacy decorative and generic SaaS font hooks are removed from source", () => {
  const files = walk(join(root, "src")).filter((file) => /\.(tsx|ts|css)$/.test(file));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /font-bricolage|font-horror|SecretSolver|Space_Grotesk|localFont/, file);
  }
});

test("dense authenticated app, auth and report surfaces do not opt into Newsreader display classes", () => {
  const denseRoots = [
    join(root, "src/app/(app)"),
    join(root, "src/app/(auth)"),
    join(root, "src/app/share"),
    join(root, "src/components/app"),
    join(root, "src/components/ui"),
  ];
  const files = denseRoots.flatMap((dir) => walk(dir)).filter((file) => /\.(tsx|ts|css)$/.test(file));
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /font-display|font-\[var\(--font-display\)\]/, file);
  }
});
