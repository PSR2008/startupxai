"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Assessment tools", href: "/#engines" },
  { label: "Pricing", href: "/pricing" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isDarkNav = !isHomePage && !scrolled;
  const useLightNavText = isHomePage || isDarkNav;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-0 right-0 z-50 transition-all duration-300",
          isHomePage ? "top-5 pointer-events-none bg-transparent" : "top-0",
          !isHomePage && (!isDarkNav
            ? "bg-white/90 backdrop-blur-xl border-b border-black/6 shadow-sm shadow-black/8"
            : "bg-[#0b0f14]/72 backdrop-blur-xl border-b border-white/[0.06]")
        )}
      >
        <div className="container-custom">
          <nav
            className={cn(
              "flex items-center justify-between",
              isHomePage
                ? "pointer-events-auto mx-auto h-[4.25rem] w-[calc(100vw-3rem)] max-w-[980px] rounded-[1.35rem] border border-white/[0.22] bg-[rgba(8,10,30,0.58)] px-4 shadow-[0_18px_50px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-[18px] sm:w-full sm:px-5"
                : "h-16"
            )}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-shadow">
                <Zap size={15} className="text-white" strokeWidth={2.5} />
              </div>
              <span className={cn("font-[var(--font-body)] text-base font-bold tracking-normal", useLightNavText ? "text-white" : "text-gray-900")}>
                StartupX{" "}
                <span className="text-gradient-brand">AI</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-xl font-[var(--font-body)] text-sm font-medium tracking-normal transition-all duration-150",
                    pathname === link.href
                      ? useLightNavText ? "text-white bg-white/10" : "text-slate-950 bg-white/35"
                      : useLightNavText ? "text-white/[0.78] hover:text-white hover:bg-white/10" : "text-slate-700 hover:text-slate-950 hover:bg-white/35"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/signin"
                className={cn(
                  "font-[var(--font-body)] text-sm font-medium tracking-normal transition-colors",
                  useLightNavText ? "text-white/[0.78] hover:text-white" : "text-slate-700 hover:text-slate-950"
                )}
              >
                Sign In
              </Link>
              <Link href="/signup?next=/evidence-engine">
                <Button
                  size="sm"
                  icon={<ChevronRight size={14} />}
                  iconPosition="right"
                  className="font-[var(--font-body)] text-[0.8125rem] font-semibold tracking-normal"
                >
                  Start assessment
                </Button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={cn(
                "md:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                useLightNavText ? "text-white/[0.82] hover:text-white hover:bg-white/10" : "text-slate-700 hover:text-slate-950 hover:bg-white/35"
              )}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </nav>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-white border-l border-black/6 flex flex-col shadow-2xl shadow-black/8"
            >
              <div className="flex items-center justify-between p-5 border-b border-black/5">
                <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <Zap size={13} className="text-white" strokeWidth={2.5} />
                  </div>
                  <span className="font-[var(--font-body)] text-sm font-bold tracking-normal text-gray-900">
                    StartupX <span className="text-gradient-brand">AI</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col p-4 gap-1 flex-1">
                {navLinks.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Link
                      href={link.href}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl font-[var(--font-body)] text-sm font-medium tracking-normal text-gray-600 hover:text-gray-900 hover:bg-black/4 transition-all"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </div>

              <div className="p-5 border-t border-black/5 space-y-3">
                <Link href="/signup?next=/evidence-engine" onClick={() => setMobileOpen(false)}>
                  <Button fullWidth icon={<ChevronRight size={14} />} className="font-[var(--font-body)]">
                    Start assessment
                  </Button>
                </Link>
                <Link
                  href="/signin"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center font-[var(--font-body)] text-sm font-medium tracking-normal text-gray-500 hover:text-gray-900 transition-colors py-1"
                >
                  Sign In
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

