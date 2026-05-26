"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Zap, LayoutDashboard, Lightbulb, Swords, DollarSign, Brain, TrendingUp, Target, MessageSquare, Palette, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const routes: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "/dashboard": { label: "Dashboard", icon: LayoutDashboard, color: "text-gray-600" },
  "/idea-engine": { label: "Idea & Market Engine", icon: Lightbulb, color: "text-emerald-600" },
  "/competitor-intelligence": { label: "Competitor Intelligence", icon: Swords, color: "text-amber-600" },
  "/revenue-engine": { label: "Revenue Engine", icon: DollarSign, color: "text-teal-600" },
  "/user-psychology": { label: "User Psychology Engine", icon: Brain, color: "text-rose-500" },
  "/growth-engine": { label: "Growth Engine", icon: TrendingUp, color: "text-blue-600" },
  "/founder-decision": { label: "Founder Decision Engine", icon: Target, color: "text-violet-600" },
  "/cold-dm": { label: "ColdDM AI", icon: MessageSquare, color: "text-emerald-600" },
  "/brand-forge": { label: "BrandForge AI", icon: Palette, color: "text-violet-600" },
};

const mobileNavItems = Object.entries(routes);

export default function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = routes[pathname];

  const handleLogout = async () => {
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
    <>
      <header className="h-14 border-b border-black/5 flex items-center justify-between px-4 lg:px-6 bg-white sticky top-0 z-30 shadow-sm shadow-black/3">
        {/* Left */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/5 transition-all"
          >
            <Menu size={16} />
          </button>

          {current && (
            <div className="flex items-center gap-2">
              <current.icon size={15} className={cn(current.color, "flex-shrink-0")} />
              <span className="font-bricolage text-sm font-bold text-gray-900">
                {current.label}
              </span>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Zap size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bricolage text-xs font-bold text-gray-900">
              StartupX <span className="text-gradient-brand">AI</span>
            </span>
          </Link>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-black/6 flex flex-col shadow-xl shadow-black/10"
            >
              <div className="flex items-center justify-between p-4 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <Zap size={12} className="text-white" strokeWidth={2.5} />
                  </div>
                  <span className="font-bricolage text-sm font-bold text-gray-900">StartupX AI</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 transition-all">
                  <X size={14} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {mobileNavItems.map(([href, { label, icon: Icon, color }]) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn("sidebar-link", pathname === href && "active")}
                  >
                    <Icon size={14} className={pathname === href ? color : "text-gray-400"} />
                    <span className="text-[13px]">{label}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-3 border-t border-black/5">
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-jakarta text-xs font-medium text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
