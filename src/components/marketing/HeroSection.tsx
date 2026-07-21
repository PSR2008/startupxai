"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, FileText, SearchCheck, ShieldCheck, TimerReset } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

const evidenceRows = [
  { label: "Founder-provided evidence", count: "3", tone: "blue" as const },
  { label: "Verified public evidence", count: "2", tone: "emerald" as const },
  { label: "Assumptions", count: "4", tone: "amber" as const },
];

const decisionRows = [
  { title: "Pricing willingness", status: "Insufficient evidence", detail: "Add customer interview notes before increasing confidence." },
  { title: "Competitor pressure", status: "Medium confidence", detail: "Two public sources reviewed; pricing proof is still missing." },
  { title: "ICP urgency", status: "Next experiment", detail: "Run 12 interviews with operations leads this week." },
];

const workflowItems = [
  { icon: SearchCheck, label: "Collect evidence", detail: "Sources, notes, interviews" },
  { icon: BarChart3, label: "Review score", detail: "Components and gaps" },
  { icon: ClipboardList, label: "Decide next test", detail: "Experiments and history" },
];

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 34]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="hero-stage relative min-h-[94svh] overflow-hidden border-b border-white/10 pt-22 pb-12 sm:pt-24 sm:pb-14"
    >
      <div className="absolute inset-0 hero-vignette" />
      <div className="hero-floor-glow" />

      <motion.div
        style={{ y, opacity }}
        className="container-custom relative flex min-h-[calc(94svh-8.5rem)] items-center"
      >
        <div className="hero-reference-frame relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[#080a0e] px-5 pb-7 pt-16 shadow-2xl sm:px-8 sm:pb-9 lg:px-12 lg:pb-12 lg:pr-14 xl:px-14 xl:pr-16">
          <div className="absolute inset-0 hero-stage-grid opacity-80" />
          <div className="absolute inset-0 hero-frame-shine" />
          <div className="hero-spotlight hero-spotlight-emerald" />
          <div className="hero-spotlight hero-spotlight-amber" />
          <div className="hero-spotlight hero-spotlight-white" />

          <div className="absolute left-5 right-5 top-4 z-10 flex items-center justify-between border-b border-white/[0.06] pb-4 text-[10px] uppercase text-slate-400 sm:left-8 sm:right-8 lg:left-12 lg:right-12">
            <span className="font-bricolage font-bold tracking-[0.34em] text-white">StartupX</span>
            <div className="hidden items-center gap-7 font-jakarta font-semibold tracking-[0.22em] md:flex">
              <span>Evidence</span>
              <span>Scores</span>
              <span>Experiments</span>
            </div>
            <span className="rounded-md border border-white/10 px-2 py-1 font-jakarta tracking-[0.18em]">Workspace</span>
          </div>

          <div className="relative z-10 grid min-h-[34rem] grid-cols-1 items-center gap-9 lg:grid-cols-[minmax(0,1.06fr)_minmax(30rem,0.94fr)] lg:gap-8 xl:gap-10">
            <div className="max-w-[43rem] pt-4 lg:pt-5">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.45 }}
                className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3 py-1.5 shadow-sm shadow-black/20 backdrop-blur-md"
              >
                <ShieldCheck size={13} className="text-emerald-300" />
                <span className="font-jakarta text-xs font-semibold text-slate-200">
                  Evidence-backed founder workspace
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="mb-6 max-w-[11.9ch] text-balance font-bricolage text-[clamp(3.1rem,7.2vw,5.05rem)] font-bold leading-[0.98] tracking-normal text-white lg:text-[clamp(4.05rem,5.45vw,5.1rem)]"
              >
                Build decisions on evidence, not optimism.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.55 }}
                className="mb-9 max-w-xl font-jakarta text-lg leading-relaxed text-slate-300"
              >
                Collect market signals, assess assumptions, track experiments, and decide what to build next.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.46, duration: 0.5 }}
                className="mb-8 flex flex-col gap-3 sm:flex-row"
              >
                <Link href="/signup?next=/evidence-engine">
                  <Button size="xl" icon={<ArrowRight size={18} />} iconPosition="right" className="shadow-xl shadow-emerald-950/40">
                    Start an assessment
                  </Button>
                </Link>
                <Link href="/#workflow">
                  <Button variant="outline" size="xl" className="border-white/14 bg-white/[0.06] text-white backdrop-blur-md hover:border-white/24 hover:bg-white/[0.1]">
                    See how it works
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {workflowItems.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.045] p-4 shadow-sm shadow-black/25 backdrop-blur-md">
                    <Icon size={15} className="mb-3 text-emerald-200" />
                    <p className="font-bricolage text-xs font-bold text-white">{label}</p>
                    <p className="mt-1 font-jakarta text-xs leading-relaxed text-slate-400">{detail}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 26, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.42, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="hero-product-wrap relative lg:-mt-14"
            >
              <div className="hero-product-ambient" />
              <div className="hero-product-panel overflow-hidden rounded-xl border border-white/18 bg-[#0d0f15] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.035] px-5 py-4">
              <div>
                <p className="font-bricolage text-sm font-bold text-white">Evidence workspace</p>
                <p className="font-jakarta text-xs text-slate-400">SaaS pricing assessment</p>
              </div>
              <Badge variant="emerald" size="sm" dot className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Updated 4 min ago</Badge>
            </div>

            <div className="grid grid-cols-1 bg-[#0d0f15] lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r lg:border-white/[0.07]">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-slate-500">Evidence Score</p>
                    <p className="mt-1 font-bricolage text-5xl font-bold text-white">62</p>
                  </div>
                  <Badge variant="amber" size="sm" className="border-amber-300/30 bg-amber-300/10 text-amber-200">Medium confidence</Badge>
                </div>
                <div className="space-y-2">
                  {evidenceRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.045] px-3 py-2">
                      <span className="font-jakarta text-xs text-slate-300">{row.label}</span>
                      <Badge variant={row.tone} size="sm">{row.count}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.08] p-3">
                  <p className="font-bricolage text-xs font-bold text-amber-100">What is still unproven</p>
                  <p className="mt-1 font-jakarta text-xs leading-relaxed text-amber-200/80">
                    Buyer urgency and willingness to pay need customer research.
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-bricolage text-sm font-bold text-white">Decision history</p>
                  <TimerReset size={15} className="text-slate-500" />
                </div>
                <div className="space-y-3">
                  {decisionRows.map((row, index) => (
                    <div key={row.title} className="relative rounded-lg border border-white/[0.08] bg-white/[0.045] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bricolage text-xs font-bold text-white">{row.title}</p>
                          <p className="mt-1 font-jakarta text-xs leading-relaxed text-slate-400">{row.detail}</p>
                        </div>
                        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-0.5 font-jakarta text-[10px] font-semibold text-slate-300">
                          {row.status}
                        </span>
                      </div>
                      {index < decisionRows.length - 1 && <div className="absolute -bottom-3 left-5 h-3 w-px bg-white/10" />}
                    </div>
                  ))}
                </div>
                <details className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.035] p-3">
                  <summary className="cursor-pointer list-none font-bricolage text-xs font-bold text-slate-200">
                    Methodology preview
                  </summary>
                  <p className="mt-2 font-jakarta text-xs leading-relaxed text-slate-400">
                    Scores combine weighted components, source reliability, missing evidence, and confidence. Generated findings are labeled separately from verified evidence.
                  </p>
                </details>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-jakarta text-xs text-slate-400">
            <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Source-backed findings</span>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span className="inline-flex items-center gap-1"><FileText size={12} /> Reports saved to workspace</span>
          </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
