"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Zap, LayoutDashboard, Lightbulb, Swords, DollarSign,
  Brain, TrendingUp, Target, MessageSquare, Palette, ArrowLeft, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Intelligence Engines",
    items: [
      { label: "Idea & Market", href: "/idea-engine", icon: Lightbulb, color: "text-emerald-600" },
      { label: "Competitor Intel", href: "/competitor-intelligence", icon: Swords, color: "text-amber-600" },
      { label: "Revenue Engine", href: "/revenue-engine", icon: DollarSign, color: "text-teal-600" },
      { label: "User Psychology", href: "/user-psychology", icon: Brain, color: "text-rose-500" },
      { label: "Growth Engine", href: "/growth-engine", icon: TrendingUp, color: "text-blue-600" },
      { label: "Founder Decision", href: "/founder-decision", icon: Target, color: "text-violet-600" },
    ],
  },
  {
    label: "Revenue Tools",
    items: [
      { label: "ColdDM AI", href: "/cold-dm", icon: MessageSquare, color: "text-emerald-600", badge: "HOT" },
      { label: "BrandForge AI", href: "/brand-forge", icon: Palette, color: "text-violet-600", badge: "NEW" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Upgrade Plan", href: "/payment", icon: Zap, color: "text-amber-600" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
    <aside className="hidden lg:flex flex-col w-58 shrink-0 h-screen sticky top-0 border-r border-black/6 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-black/5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
          <Zap size={13} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bricolage text-sm font-bold text-gray-900">
          StartupX <span className="text-gradient-brand">AI</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 font-bricolage text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("sidebar-link", isActive && "active")}
                  >
                    <Icon
                      size={15}
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        isActive
                          ? ("color" in item ? item.color : "text-emerald-600")
                          : "text-gray-400"
                      )}
                    />
                    <span className="flex-1 text-[13px]">{item.label}</span>
                    {"badge" in item && item.badge && (
                      <span className="text-[9px] font-bricolage font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 leading-none">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-emerald-50 rounded-[10px]"
                        style={{ zIndex: -1 }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-black/5 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-jakarta text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-black/4 transition-all"
        >
          <ArrowLeft size={13} />
          Back to landing
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-jakarta text-xs font-medium text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
