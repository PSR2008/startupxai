"use client";

import { useEffect } from "react";

export default function AuthFragmentGuard() {
  useEffect(() => {
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
