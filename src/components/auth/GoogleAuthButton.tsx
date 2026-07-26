"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  buildGoogleOAuthRedirectTo,
  GOOGLE_AUTH_ERROR_MESSAGE,
  isExpectedGoogleAuthorizationUrl,
  normalizeAuthNextPath,
} from "@/lib/auth-flow";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function GoogleAuthButton({ nextPath }: { nextPath?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startGoogleAuth() {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const safeNext = normalizeAuthNextPath(nextPath);
      const redirectTo = buildGoogleOAuthRedirectTo(window.location.origin, safeNext);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (!data?.url || !isExpectedGoogleAuthorizationUrl(data.url, redirectTo)) {
        if (process.env.NODE_ENV === "development") {
          throw new Error("Google OAuth authorization URL is missing the application callback redirect.");
        }
        throw new Error("Google OAuth could not be started.");
      }
      window.location.assign(data.url);
    } catch {
      setError(GOOGLE_AUTH_ERROR_MESSAGE);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startGoogleAuth}
        disabled={loading}
        aria-label="Continue with Google"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 font-jakarta text-sm font-semibold text-gray-800 shadow-sm shadow-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0"
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-emerald-600 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon />
        )}
        {loading ? "Opening Google..." : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 font-jakarta text-xs leading-relaxed text-rose-600">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
