"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (!session.user.email_confirmed_at) {
        await supabase.auth.signOut();
        router.replace("/signin?reason=confirm-email");
        return;
      }

      if (pathname !== "/onboarding") {
        const res = await fetch("/api/founder-profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && !data.profile) {
          router.replace("/onboarding");
          return;
        }
      }

      if (mounted) setAllowed(true);
    }

    checkAuth();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
        <div className="flex items-center gap-2 rounded-2xl border border-black/6 bg-white px-5 py-4 shadow-sm">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          <span className="font-jakarta text-sm text-gray-500">Checking account...</span>
        </div>
      </div>
    );
  }

  return children;
}
