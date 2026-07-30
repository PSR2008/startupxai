"use client";

import { useEffect } from "react";

const SCROLLING_CLASS = "homepage-is-scrolling";
const STOP_DELAY_MS = 175;

export default function HomepageScrollState() {
  useEffect(() => {
    let stopTimer: number | null = null;
    let isScrolling = false;

    const setScrolling = (scrolling: boolean) => {
      if (isScrolling === scrolling) return;
      isScrolling = scrolling;
      document.documentElement.classList.toggle(SCROLLING_CLASS, scrolling);
      window.dispatchEvent(new CustomEvent(scrolling ? "startupx:homepage-scroll-start" : "startupx:homepage-scroll-stop"));
    };

    const onScroll = () => {
      setScrolling(true);
      if (stopTimer) window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => {
        setScrolling(false);
        stopTimer = null;
      }, STOP_DELAY_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (stopTimer) window.clearTimeout(stopTimer);
      document.documentElement.classList.remove(SCROLLING_CLASS);
    };
  }, []);

  return null;
}
