"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const SESSION_CHECK_TIMEOUT_MS = 8000;

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const redirectToSignin = () => {
        router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
      };

      try {
        const supabase = getSupabaseBrowserClient();
        const timeout = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Auth session check timed out")), SESSION_CHECK_TIMEOUT_MS);
        });
        const {
          data: { session },
        } = await Promise.race([supabase.auth.getSession(), timeout]);

        if (!mounted) {
          return;
        }

        if (!session?.user) {
          redirectToSignin();
          return;
        }

        if (!session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          router.replace("/signin?reason=confirm-email");
          return;
        }

        setAllowed(true);
      } catch {
        if (!mounted) {
          return;
        }
        redirectToSignin();
        return;
      }
    }

    checkAuth();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="surface-panel flex items-center gap-2 px-5 py-4">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          <span className="font-jakarta text-sm text-gray-500">Checking account...</span>
        </div>
      </div>
    );
  }

  return children;
}
