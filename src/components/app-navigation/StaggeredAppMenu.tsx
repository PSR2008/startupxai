"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, LogOut, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import "./StaggeredAppMenu.css";

type AppMenuItem = {
  label: string;
  href: string;
  group: string;
  badge?: string;
  ariaLabel?: string;
};

const APP_MENU_ITEMS: AppMenuItem[] = [
  { group: "Overview", label: "Dashboard", href: "/dashboard" },
  { group: "Overview", label: "Evidence Engine", href: "/evidence-engine", badge: "Core" },
  { group: "Overview", label: "Assumptions", href: "/evidence-engine#assumptions" },
  { group: "Overview", label: "Experiments", href: "/evidence-engine#experiments" },
  { group: "Overview", label: "Competitor Intelligence", href: "/competitor-intelligence" },
  { group: "Overview", label: "Reports", href: "/reports" },
  { group: "Assessments", label: "Idea & Market", href: "/idea-engine" },
  { group: "Assessments", label: "Revenue Engine", href: "/revenue-engine" },
  { group: "Assessments", label: "User Psychology", href: "/user-psychology" },
  { group: "Assessments", label: "Growth Engine", href: "/growth-engine" },
  { group: "Assessments", label: "Founder Decision", href: "/founder-decision" },
  { group: "Revenue tools", label: "ColdDM", href: "/cold-dm", badge: "Hot" },
  { group: "Revenue tools", label: "BrandForge", href: "/brand-forge", badge: "New" },
  { group: "Account", label: "Founder Setup", href: "/onboarding" },
  { group: "Account", label: "Profile", href: "/profile" },
  { group: "Account", label: "Diagnostics", href: "/internal" },
  { group: "Account", label: "Upgrade Plan", href: "/payment" },
];

const LAYER_COLORS = ["#064e3b", "#0f766e", "#fffefa"];

function isRouteActive(pathname: string, href: string) {
  const route = href.split("#")[0];
  if (route === "/reports") return pathname === "/reports" || pathname.startsWith("/reports/");
  return pathname === route;
}

export default function StaggeredAppMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toggleLines, setToggleLines] = useState(["Menu", "Close"]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const plusHRef = useRef<HTMLSpanElement | null>(null);
  const plusVRef = useRef<HTMLSpanElement | null>(null);
  const toggleTextRef = useRef<HTMLSpanElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const openTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const textTweenRef = useRef<gsap.core.Tween | null>(null);
  const reducedMotionRef = useRef(false);

  const groupedItems = useMemo(() => {
    return APP_MENU_ITEMS.reduce<Record<string, AppMenuItem[]>>((groups, item) => {
      groups[item.group] = groups[item.group] ?? [];
      groups[item.group].push(item);
      return groups;
    }, {});
  }, []);

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = reducedMotion.matches;

    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const layers = Array.from(preLayersRef.current?.querySelectorAll<HTMLElement>(".staggered-app-menu__prelayer") ?? []);
      if (!panel) return;

      gsap.set([panel, ...layers], { xPercent: -100, opacity: 1 });
      gsap.set([plusHRef.current, plusVRef.current, iconRef.current, toggleTextRef.current], {
        transformOrigin: "50% 50%",
      });
      gsap.set(plusVRef.current, { rotate: 90 });
      gsap.set(iconRef.current, { rotate: 0 });
      gsap.set(toggleTextRef.current, { yPercent: 0 });
    }, wrapperRef);

    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
    };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      reducedMotion.removeEventListener("change", onMotionChange);
      ctx.revert();
    };
  }, []);

  const animateToggleText = useCallback((opening: boolean) => {
    const inner = toggleTextRef.current;
    if (!inner) return;
    textTweenRef.current?.kill();

    const current = opening ? "Menu" : "Close";
    const target = opening ? "Close" : "Menu";
    const sequence = reducedMotionRef.current ? [target] : [current, target, current, target];
    setToggleLines(sequence);
    gsap.set(inner, { yPercent: 0 });
    textTweenRef.current = gsap.to(inner, {
      yPercent: -(((sequence.length - 1) / sequence.length) * 100),
      duration: reducedMotionRef.current ? 0 : 0.52,
      ease: "power4.out",
    });
  }, []);

  const openMenu = useCallback(() => {
    if (busy) return;
    const panel = panelRef.current;
    const layers = Array.from(preLayersRef.current?.querySelectorAll<HTMLElement>(".staggered-app-menu__prelayer") ?? []);
    if (!panel) return;

    setOpen(true);
    setBusy(true);
    document.documentElement.classList.add("app-menu-open");
    closeTweenRef.current?.kill();
    openTimelineRef.current?.kill();

    const labels = Array.from(panel.querySelectorAll<HTMLElement>(".staggered-app-menu__item-label"));
    const items = Array.from(panel.querySelectorAll<HTMLElement>(".staggered-app-menu__item"));
    const utilities = Array.from(panel.querySelectorAll<HTMLElement>(".staggered-app-menu__utility"));

    if (reducedMotionRef.current) {
      gsap.set([panel, ...layers], { xPercent: 0 });
      gsap.set([...labels, ...items, ...utilities], { clearProps: "all" });
      setBusy(false);
    } else {
      gsap.set(labels, { yPercent: 140, rotate: 9 });
      gsap.set(items, { "--staggered-app-menu-num-opacity": 0 });
      gsap.set(utilities, { y: 18, opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () => setBusy(false),
      });

      layers.forEach((layer, index) => {
        tl.fromTo(layer, { xPercent: -100 }, { xPercent: 0, duration: 0.48, ease: "power4.out" }, index * 0.07);
      });
      const panelStart = layers.length ? (layers.length - 1) * 0.07 + 0.08 : 0;
      tl.fromTo(panel, { xPercent: -100 }, { xPercent: 0, duration: 0.62, ease: "power4.out" }, panelStart);
      tl.to(
        labels,
        {
          yPercent: 0,
          rotate: 0,
          duration: 0.86,
          ease: "power4.out",
          stagger: { each: 0.045, from: "start" },
        },
        panelStart + 0.12,
      );
      tl.to(
        items,
        {
          "--staggered-app-menu-num-opacity": 1,
          duration: 0.4,
          ease: "power2.out",
          stagger: { each: 0.035, from: "start" },
        },
        panelStart + 0.2,
      );
      tl.to(
        utilities,
        {
          y: 0,
          opacity: 1,
          duration: 0.42,
          ease: "power3.out",
          stagger: 0.04,
        },
        panelStart + 0.34,
      );
      openTimelineRef.current = tl;
    }

    gsap.to(iconRef.current, { rotate: reducedMotionRef.current ? 225 : 225, duration: reducedMotionRef.current ? 0 : 0.72, ease: "power4.out" });
    animateToggleText(true);
  }, [animateToggleText, busy]);

  const closeMenu = useCallback(() => {
    if (!open && !busy) return;
    const panel = panelRef.current;
    const layers = Array.from(preLayersRef.current?.querySelectorAll<HTMLElement>(".staggered-app-menu__prelayer") ?? []);
    if (!panel) return;

    setOpen(false);
    setBusy(true);
    document.documentElement.classList.remove("app-menu-open");
    openTimelineRef.current?.kill();
    closeTweenRef.current?.kill();

    const complete = () => {
      const labels = Array.from(panel.querySelectorAll<HTMLElement>(".staggered-app-menu__item-label"));
      const items = Array.from(panel.querySelectorAll<HTMLElement>(".staggered-app-menu__item"));
      gsap.set(labels, { yPercent: 140, rotate: 9 });
      gsap.set(items, { "--staggered-app-menu-num-opacity": 0 });
      setBusy(false);
    };

    if (reducedMotionRef.current) {
      gsap.set([panel, ...layers], { xPercent: -100 });
      complete();
    } else {
      closeTweenRef.current = gsap.to([panel, ...layers], {
        xPercent: -100,
        duration: 0.32,
        ease: "power3.in",
        overwrite: "auto",
        onComplete: complete,
      });
    }

    gsap.to(iconRef.current, { rotate: 0, duration: reducedMotionRef.current ? 0 : 0.34, ease: "power3.inOut" });
    animateToggleText(false);
  }, [animateToggleText, busy, open]);

  const toggleMenu = useCallback(() => {
    if (open) closeMenu();
    else openMenu();
  }, [closeMenu, open, openMenu]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleButtonRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("app-menu-open");
    };
  }, []);

  const handleNavigate = useCallback(() => {
    window.setTimeout(closeMenu, 40);
  }, [closeMenu]);

  const handleLogout = async () => {
    closeMenu();
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // best-effort
    } finally {
      router.push("/signin");
      router.refresh();
    }
  };

  return (
    <div ref={wrapperRef} className="staggered-app-menu" data-open={open || undefined}>
      <div ref={preLayersRef} className="staggered-app-menu__prelayers" aria-hidden="true">
        {LAYER_COLORS.map((color) => (
          <div key={color} className="staggered-app-menu__prelayer" style={{ background: color }} />
        ))}
      </div>

      <button
        ref={toggleButtonRef}
        type="button"
        className="staggered-app-menu__toggle focus-ring"
        aria-label={open ? "Close app navigation" : "Open app navigation"}
        aria-expanded={open}
        aria-controls="staggered-app-menu-panel"
        onClick={toggleMenu}
      >
        <span className="staggered-app-menu__toggle-text-wrap" aria-hidden="true">
          <span ref={toggleTextRef} className="staggered-app-menu__toggle-text">
            {toggleLines.map((line, index) => (
              <span key={`${line}-${index}`} className="staggered-app-menu__toggle-line">
                {line}
              </span>
            ))}
          </span>
        </span>
        <span ref={iconRef} className="staggered-app-menu__icon" aria-hidden="true">
          <span ref={plusHRef} className="staggered-app-menu__icon-line" />
          <span ref={plusVRef} className="staggered-app-menu__icon-line staggered-app-menu__icon-line--vertical" />
        </span>
      </button>

      {open && <div className="staggered-app-menu__scrim" aria-hidden="true" />}

      <aside
        id="staggered-app-menu-panel"
        ref={panelRef}
        className="staggered-app-menu__panel"
        aria-hidden={!open}
        aria-label="Authenticated application navigation"
      >
        <div className="staggered-app-menu__inner">
          <div className="staggered-app-menu__brand">
            <div className="staggered-app-menu__mark">
              <Zap size={15} strokeWidth={2.5} />
            </div>
            <div>
              <p>StartupX AI</p>
              <span>Founder workspace</span>
            </div>
          </div>

          <nav className="staggered-app-menu__nav" aria-label="Application routes">
            {Object.entries(groupedItems).map(([group, items]) => (
              <section key={group} className="staggered-app-menu__group">
                <p className="staggered-app-menu__group-label">{group}</p>
                <ul className="staggered-app-menu__list" role="list" data-numbering>
                  {items.map((item) => {
                    const active = isRouteActive(pathname, item.href);
                    return (
                      <li key={item.href} className="staggered-app-menu__item-wrap">
                        <Link
                          href={item.href}
                          aria-label={item.ariaLabel ?? `Open ${item.label}`}
                          aria-current={active ? "page" : undefined}
                          className="staggered-app-menu__item"
                          data-active={active || undefined}
                          onClick={handleNavigate}
                        >
                          <span className="staggered-app-menu__item-label">{item.label}</span>
                          {item.badge && <span className="staggered-app-menu__badge">{item.badge}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>

          <div className="staggered-app-menu__utilities" aria-label="Account actions">
            <Link href="/" className="staggered-app-menu__utility" onClick={handleNavigate}>
              <ArrowLeft size={15} />
              Back to landing
            </Link>
            <button type="button" className="staggered-app-menu__utility staggered-app-menu__utility--danger" onClick={handleLogout}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export { APP_MENU_ITEMS };
