"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

export default function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="resadex-hero relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden">
      <div className="resadex-liquid-field" aria-hidden="true">
        <div className="resadex-ring resadex-ring-one" />
        <div className="resadex-ring resadex-ring-two" />
        <div className="resadex-ring resadex-ring-three" />
        <div className="resadex-ring resadex-ring-four" />
      </div>
      <div className="resadex-center-bead" aria-hidden="true" />

      <motion.div
        className="resadex-orb-wrap"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.94 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        aria-hidden="true"
      >
        <div className="resadex-orb-shadow" />
        <div className="resadex-orb">
          <div className="resadex-orb-core" />
          <div className="resadex-orb-bead" />
        </div>
      </motion.div>

      <div className="resadex-copy relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center">
        <p className="resadex-kicker">
          Evidence-backed founder workspace
        </p>

        <h1 className="resadex-title">
          <span>STARTUPX</span>
          <span>AI</span>
        </h1>

        <p className="resadex-subtitle">
          Collect market signals, assess assumptions, track experiments, and decide what to build next.
        </p>

        <div className="resadex-actions">
          <Link href="/signup?next=/evidence-engine">Start assessment</Link>
          <Link href="/#workflow">See workflow</Link>
        </div>
      </div>

      <div className="resadex-scroll-cue" aria-hidden="true">
        Scroll down
      </div>
    </section>
  );
}
