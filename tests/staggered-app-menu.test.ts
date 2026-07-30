import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const appLayout = readFileSync(join(root, "src/app/(app)/layout.tsx"), "utf8");
const topbar = readFileSync(join(root, "src/components/app/AppTopbar.tsx"), "utf8");
const menu = readFileSync(join(root, "src/components/app-navigation/StaggeredAppMenu.tsx"), "utf8");
const menuCss = readFileSync(join(root, "src/components/app-navigation/StaggeredAppMenu.css"), "utf8");
const exportsFile = readFileSync(join(root, "src/components/app-navigation/index.ts"), "utf8");
const homepageNavbar = readFileSync(join(root, "src/components/marketing/Navbar.tsx"), "utf8");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
};

test("authenticated layout uses StaggeredAppMenu and does not render the old sidebar", () => {
  assert.doesNotMatch(appLayout, /Sidebar/);
  assert.match(topbar, /import \{ StaggeredAppMenu \} from "@\/components\/app-navigation"/);
  assert.match(topbar, /<StaggeredAppMenu \/>/);
  assert.doesNotMatch(topbar, /AnimatePresence|mobileOpen|Mobile nav drawer|<Menu size|<X size/);
  assert.match(exportsFile, /StaggeredAppMenu/);
});

test("StaggeredAppMenu preserves every authenticated app route and account action", () => {
  for (const href of [
    "/dashboard",
    "/evidence-engine",
    "/evidence-engine#assumptions",
    "/evidence-engine#experiments",
    "/competitor-intelligence",
    "/reports",
    "/idea-engine",
    "/revenue-engine",
    "/user-psychology",
    "/growth-engine",
    "/founder-decision",
    "/cold-dm",
    "/brand-forge",
    "/onboarding",
    "/profile",
    "/internal",
    "/payment",
  ]) {
    assert.match(menu, new RegExp(`href: "${href.replace("/", "\\/")}`));
  }

  for (const label of [
    "Dashboard",
    "Evidence Engine",
    "Assumptions",
    "Experiments",
    "Competitor Intelligence",
    "Reports",
    "Idea & Market",
    "Revenue Engine",
    "User Psychology",
    "Growth Engine",
    "Founder Decision",
    "ColdDM",
    "BrandForge",
    "Founder Setup",
    "Profile",
    "Diagnostics",
    "Upgrade Plan",
    "Back to landing",
    "Sign out",
  ]) {
    assert.match(menu, new RegExp(label));
  }
});

test("StaggeredAppMenu uses React Bits staggered GSAP interaction without continuous loops", () => {
  assert.ok(packageJson.dependencies.gsap, "GSAP should be reused from MagicBento");
  assert.match(menu, /"use client"/);
  assert.match(menu, /import \{ gsap \} from "gsap"/);
  assert.match(menu, /gsap\.timeline/);
  assert.match(menu, /stagger: \{ each:/);
  assert.match(menu, /staggered-app-menu__prelayer/);
  assert.match(menu, /staggered-app-menu__item-label/);
  assert.doesNotMatch(menu, /requestAnimationFrame|setInterval/);
});

test("StaggeredAppMenu opens from the left, numbers items, tracks active route and closes after navigation", () => {
  assert.match(menu, /createPortal/);
  assert.match(menu, /document\.body/);
  assert.match(menu, /className="sx-staggered-menu-root"/);
  assert.match(menuCss, /\.sx-staggered-menu-root[\s\S]+position: fixed/);
  assert.match(menuCss, /\.sx-staggered-menu-root[\s\S]+height: 100dvh/);
  assert.match(menuCss, /\.sx-staggered-menu-root[\s\S]+z-index: 1000/);
  assert.match(menuCss, /\.sx-staggered-menu-root[\s\S]+overflow: hidden/);
  assert.match(menuCss, /\.staggered-app-menu__panel[\s\S]+inset: 0 auto 0 0/);
  assert.match(menuCss, /\.staggered-app-menu__panel[\s\S]+height: 100dvh/);
  assert.match(menuCss, /\.staggered-app-menu__prelayers[\s\S]+inset: 0 auto 0 0/);
  assert.match(menuCss, /\.staggered-app-menu__prelayers[\s\S]+height: 100dvh/);
  assert.match(menuCss, /counter\(appMenuItem, decimal-leading-zero\)/);
  assert.match(menu, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(menu, /data-active=\{active \|\| undefined\}/);
  assert.match(menu, /pathname\.startsWith\("\/reports\/"\)/);
  assert.match(menu, /window\.setTimeout\(closeMenu, 40\)/);
  assert.match(menu, /Escape/);
  assert.match(menu, /mousedown/);
});

test("StaggeredAppMenu keeps branding, accessibility and reduced-motion safeguards", () => {
  assert.match(menu, /StartupX AI/);
  assert.match(menu, /Founder workspace/);
  assert.match(menu, /aria-expanded=\{open\}/);
  assert.match(menu, /aria-controls="staggered-menu-panel"/);
  assert.match(menu, /id="staggered-menu-panel"/);
  assert.match(menu, /aria-label="Authenticated application navigation"/);
  assert.match(menu, /aria-label="Close app navigation"/);
  assert.match(menu, /prefers-reduced-motion: reduce/);
  assert.match(menuCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(menuCss, /html\.app-menu-open/);
  assert.match(menuCss, /html\.app-menu-open body/);
});

test("public homepage navigation and protected business logic remain untouched", () => {
  assert.doesNotMatch(homepageNavbar, /StaggeredAppMenu|staggered-app-menu/);

  const protectedFiles = [
    "src/lib/entitlements.ts",
    "src/lib/evidence-scoring.ts",
    "src/lib/payment-activation.ts",
    "src/lib/subscription.ts",
    "src/app/api/auth/oauth-intent/route.ts",
    "src/app/api/razorpay/create-order/route.ts",
    "src/app/api/razorpay/verify-payment/route.ts",
    "src/app/api/razorpay/webhook/route.ts",
    "src/app/(auth)/signin/page.tsx",
    "src/app/(auth)/signup/page.tsx",
  ];

  for (const file of protectedFiles) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /StaggeredAppMenu|staggered-app-menu/);
  }
});
