"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  UserCircle,
  Zap,
  LogOut,
} from "lucide-react";
import { StaggeredAppMenu } from "@/components/app-navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const routes: Record<string, { label: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/onboarding": { label: "Founder Setup" },
  "/reports": { label: "Reports" },
  "/evidence-engine": { label: "Evidence Engine" },
  "/idea-engine": { label: "Idea & Market Engine" },
  "/competitor-intelligence": { label: "Competitor Intelligence" },
  "/revenue-engine": { label: "Revenue Engine" },
  "/user-psychology": { label: "User Psychology Engine" },
  "/growth-engine": { label: "Growth Engine" },
  "/founder-decision": { label: "Founder Decision Engine" },
  "/cold-dm": { label: "ColdDM" },
  "/brand-forge": { label: "BrandForge" },
  "/profile": { label: "Profile" },
  "/internal": { label: "Diagnostics" },
  "/payment": { label: "Upgrade Plan" },
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
          <div className="flex min-w-0 items-center">
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
