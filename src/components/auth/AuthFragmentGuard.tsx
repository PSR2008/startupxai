"use client";

import { useEffect } from "react";

export default function AuthFragmentGuard() {
  useEffect(() => {
    if (window.location.pathname === "/" && new URLSearchParams(window.location.search).has("code")) {
      window.history.replaceState(null, "", "/");
      window.location.replace("/signin?reason=google-callback-misdirected");
      return;
    }

    const fragment = window.location.hash;
    if (!fragment || (!fragment.includes("access_token") && !fragment.includes("refresh_token"))) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
    window.location.replace("/signin?reason=google-error");
  }, []);

  return null;
}
