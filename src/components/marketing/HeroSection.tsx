"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import type { PointerEvent } from "react";
import { useRef } from "react";
import { ArrowRight, BarChart3, ClipboardList, SearchCheck, ShieldCheck } from "lucide-react";
import Button from "@/components/ui/Button";

const workflowItems = [
  { icon: SearchCheck, label: "Collect evidence", detail: "Sources, interviews, and signals" },
  { icon: BarChart3, label: "Challenge assumptions", detail: "Connect claims to proof and contradictions" },
  { icon: ClipboardList, label: "Run the next test", detail: "Track experiments and record decisions" },
];

const sceneLabels = ["Source", "Claim", "Experiment", "Decision"];
const evidenceSummary = ["3 supporting sources", "2 contradictions", "Confidence: medium"];

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 45, damping: 24, mass: 0.8 });
  const springY = useSpring(pointerY, { stiffness: 45, damping: 24, mass: 0.8 });

  const sceneRotateY = useTransform(springX, [-1, 1], shouldReduceMotion ? [0, 0] : [-3, 3]);
  const sceneRotateX = useTransform(springY, [-1, 1], shouldReduceMotion ? [0, 0] : [2.4, -2.4]);

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (shouldReduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      className="hero-stage relative min-h-[96svh] overflow-hidden border-b border-white/10 pt-[5.35rem] pb-12 sm:pt-24 sm:pb-16"
    >
      <div className="absolute inset-0 hero-vignette" aria-hidden="true" />
      <div className="hero-floor-glow" aria-hidden="true" />

      <motion.div className="container-custom relative flex min-h-[calc(96svh-8.5rem)] items-center">
        <div className="hero-reference-frame relative min-w-0 w-full max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-white/12 bg-[#05070a] px-5 pb-7 pt-16 shadow-2xl sm:max-w-full sm:px-8 sm:pb-9 lg:px-12 lg:pb-12 xl:px-14">
          <div className="absolute inset-0 hero-stage-grid opacity-80" aria-hidden="true" />
          <div className="absolute inset-0 hero-frame-shine" aria-hidden="true" />
          <div className="hero-spotlight hero-spotlight-emerald" aria-hidden="true" />
          <div className="hero-spotlight hero-spotlight-silver" aria-hidden="true" />
          <div className="hero-spotlight hero-spotlight-white" aria-hidden="true" />

          <div className="absolute left-5 right-5 top-4 z-10 flex items-center justify-between border-b border-white/[0.06] pb-4 text-[10px] text-slate-400 sm:left-8 sm:right-8 lg:left-12 lg:right-12">
            <span className="font-bricolage font-bold tracking-[0.28em] text-white">StartupX</span>
            <div className="hidden items-center gap-3 font-mono text-[9px] font-medium text-slate-400 md:flex">
              {sceneLabels.map((label) => (
                <span key={label} className="inline-flex items-center gap-3">
                  {label}
                  {label !== "Decision" && <span className="h-px w-5 bg-emerald-300/35" />}
                </span>
              ))}
            </div>
            <span className="hidden rounded-md border border-white/10 px-2 py-1 font-jakarta text-slate-300 sm:inline-flex">Evidence Core</span>
          </div>

          <div className="relative z-10 grid min-h-[35rem] min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-8 xl:gap-10">
            <div className="min-w-0 max-w-full pt-4 lg:max-w-[43rem] lg:pt-6">
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.055] px-3 py-1.5 shadow-sm shadow-black/20 backdrop-blur-md">
                <ShieldCheck size={13} className="text-emerald-300" />
                <span className="font-jakarta text-xs font-semibold text-slate-200">
                  Evidence-backed founder workspace
                </span>
              </div>

              <h1 className="mb-8 max-w-[16.6ch] text-balance font-bricolage text-[clamp(2.1rem,8.8vw,4.75rem)] font-bold leading-[0.98] tracking-normal text-white lg:text-[clamp(3.75rem,4.95vw,4.85rem)]">
                Build decisions on evidence, not optimism.
              </h1>

              <p className="mb-9 max-w-[20rem] [overflow-wrap:anywhere] font-jakarta text-lg leading-relaxed text-slate-200/90 sm:max-w-xl">
                Collect market signals, assess assumptions, track experiments, and decide what to build next.
              </p>

              <div className="mb-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup?next=/evidence-engine">
                  <Button size="xl" icon={<ArrowRight size={18} />} iconPosition="right" className="shadow-xl shadow-emerald-950/40">
                    Start an assessment
                  </Button>
                </Link>
                <Link href="/#workflow">
                  <Button variant="outline" size="xl" className="border-white/10 bg-white/[0.03] text-slate-100 backdrop-blur-md hover:border-white/18 hover:bg-white/[0.065]">
                    See how it works
                  </Button>
                </Link>
              </div>

              <div className="grid max-w-[20rem] grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-3">
                {workflowItems.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="rounded-md border border-white/10 bg-white/[0.04] p-3.5 shadow-sm shadow-black/25 backdrop-blur-md">
                    <Icon size={15} className="mb-2.5 text-emerald-200" />
                    <p className="font-bricolage text-xs font-bold text-white">{label}</p>
                    <p className="mt-1 font-jakarta text-xs leading-relaxed text-slate-400">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              className="hero-cinematic-scene relative min-h-[25rem] min-w-0 max-w-full overflow-hidden w-full justify-self-end lg:min-h-[34rem] lg:-translate-x-2 xl:translate-x-1"
              style={{ rotateX: sceneRotateX, rotateY: sceneRotateY }}
              aria-hidden="true"
            >
              <div className="hero-perspective-field">
                <div className="hero-back-pillar hero-back-pillar-left">
                  <span>Assumptions</span>
                </div>
                <div className="hero-back-pillar hero-back-pillar-right">
                  <span>Evidence</span>
                </div>
                <div className="hero-decision-platform">
                  <span>Decision</span>
                </div>
                <div className="hero-path hero-path-a" />
                <div className="hero-path hero-path-b" />
                <div className="hero-path hero-path-c" />
                <div className="hero-workflow-label hero-workflow-source">Source</div>
                <div className="hero-workflow-label hero-workflow-claim">Claim</div>
                <div className="hero-workflow-label hero-workflow-experiment">Experiment</div>
                <div className="hero-workflow-label hero-workflow-decision">Decision</div>
                <div className="hero-scene-caption">From assumption to decision</div>
                <div className="hero-evidence-summary">
                  {evidenceSummary.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>

                <div className="hero-evidence-core">
                  <div className="hero-core-shadow" />
                  <div className="hero-core-ring hero-core-ring-outer" />
                  <div className="hero-core-ring hero-core-ring-mid" />
                  <div className="hero-core-ring hero-core-ring-inner" />
                  <svg className="hero-core-symbol" viewBox="0 0 120 120" aria-hidden="true">
                    <path d="M30 61h23l13-22 24 42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="30" cy="61" r="6" />
                    <circle cx="53" cy="61" r="5" />
                    <circle cx="66" cy="39" r="5" />
                    <circle cx="90" cy="81" r="6" />
                  </svg>
                  <div className="hero-core-notch hero-core-notch-one" />
                  <div className="hero-core-notch hero-core-notch-two" />
                  <div className="hero-core-notch hero-core-notch-three" />
                </div>

                <div className="hero-step-block hero-step-one">
                  <span>Source</span>
                </div>
                <div className="hero-step-block hero-step-two">
                  <span>Experiment</span>
                </div>
                <div className="hero-step-block hero-step-three">
                  <span>Claim</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
