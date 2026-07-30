"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ElementType } from "react";
import {
  Activity,
  Brain,
  Compass,
  Crown,
  DollarSign,
  FileText,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Palette,
  SearchCheck,
  Swords,
  Target,
  TrendingUp,
  UserCircle,
  Zap,
  LogOut,
} from "lucide-react";
import { StaggeredAppMenu } from "@/components/app-navigation";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const routes: Record<string, { label: string; icon: ElementType; color: string }> = {
  "/dashboard": { label: "Dashboard", icon: LayoutDashboard, color: "text-gray-600" },
  "/onboarding": { label: "Founder Setup", icon: Compass, color: "text-emerald-600" },
  "/reports": { label: "Reports", icon: FileText, color: "text-emerald-600" },
  "/evidence-engine": { label: "Evidence Engine", icon: SearchCheck, color: "text-emerald-600" },
  "/idea-engine": { label: "Idea & Market Engine", icon: Lightbulb, color: "text-emerald-600" },
  "/competitor-intelligence": { label: "Competitor Intelligence", icon: Swords, color: "text-amber-600" },
  "/revenue-engine": { label: "Revenue Engine", icon: DollarSign, color: "text-teal-600" },
  "/user-psychology": { label: "User Psychology Engine", icon: Brain, color: "text-rose-500" },
  "/growth-engine": { label: "Growth Engine", icon: TrendingUp, color: "text-blue-600" },
  "/founder-decision": { label: "Founder Decision Engine", icon: Target, color: "text-violet-600" },
  "/cold-dm": { label: "ColdDM", icon: MessageSquare, color: "text-emerald-600" },
  "/brand-forge": { label: "BrandForge", icon: Palette, color: "text-violet-600" },
  "/profile": { label: "Profile", icon: UserCircle, color: "text-emerald-600" },
  "/internal": { label: "Diagnostics", icon: Activity, color: "text-blue-600" },
  "/payment": { label: "Upgrade Plan", icon: Crown, color: "text-amber-600" },
};

export default function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const current = routes[pathname] ?? (pathname.startsWith("/reports/") ? routes["/reports"] : undefined);

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
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-black/8 bg-[#fffefa]/94 px-4 shadow-sm shadow-black/[0.03] backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <StaggeredAppMenu />
        {current && (
          <div className="flex min-w-0 items-center gap-2">
            <current.icon size={15} className={cn(current.color, "flex-shrink-0")} />
            <span className="truncate font-jakarta text-sm font-bold text-gray-950">
              {current.label}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link href="/" className="hidden items-center gap-2 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Zap size={13} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-jakarta text-sm font-bold text-gray-900">
            StartupX <span className="text-gradient-brand">AI</span>
          </span>
        </Link>
        <Link
          href="/profile"
          title="Profile"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-emerald-50 hover:text-emerald-700 focus-ring sm:flex"
        >
          <UserCircle size={15} />
        </Link>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-rose-50 hover:text-rose-600 focus-ring sm:flex"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
