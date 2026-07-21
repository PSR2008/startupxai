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
      className="relative min-h-[94svh] overflow-hidden border-b border-black/6 bg-[#f6f4ef] pt-24 pb-14"
    >
      <div className="absolute inset-0 surface-grid opacity-55" />

      <motion.div
        style={{ y, opacity }}
        className="container-custom relative grid min-h-[calc(94svh-9rem)] grid-cols-1 items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]"
      >
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="mb-7 inline-flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-1.5 shadow-sm"
          >
            <ShieldCheck size={13} className="text-emerald-700" />
            <span className="font-jakarta text-xs font-semibold text-gray-600">
              Evidence-backed founder workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 font-bricolage text-5xl font-bold leading-[1.02] tracking-tight text-gray-950 sm:text-6xl lg:text-7xl"
          >
            Build decisions on evidence, not optimism.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.55 }}
            className="mb-9 max-w-xl font-jakarta text-lg leading-relaxed text-gray-600"
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
              <Button size="xl" icon={<ArrowRight size={18} />} iconPosition="right">
                Start an assessment
              </Button>
            </Link>
            <Link href="/#workflow">
              <Button variant="outline" size="xl">
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
              <div key={label} className="rounded-xl border border-black/6 bg-white/90 p-4 shadow-sm">
                <Icon size={15} className="mb-3 text-gray-700" />
                <p className="font-bricolage text-xs font-bold text-gray-900">{label}</p>
                <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.42, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between border-b border-black/6 bg-[#fbfaf7] px-5 py-4">
              <div>
                <p className="font-bricolage text-sm font-bold text-gray-900">Evidence workspace</p>
                <p className="font-jakarta text-xs text-gray-500">SaaS pricing assessment</p>
              </div>
              <Badge variant="emerald" size="sm" dot>Updated 4 min ago</Badge>
            </div>

            <div className="grid grid-cols-1 bg-white lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-black/6 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-gray-500">Evidence Score</p>
                    <p className="mt-1 font-bricolage text-5xl font-bold text-gray-950">62</p>
                  </div>
                  <Badge variant="amber" size="sm">Medium confidence</Badge>
                </div>
                <div className="space-y-2">
                  {evidenceRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg border border-black/6 bg-gray-50 px-3 py-2">
                      <span className="font-jakarta text-xs text-gray-600">{row.label}</span>
                      <Badge variant={row.tone} size="sm">{row.count}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="font-bricolage text-xs font-bold text-amber-900">What is still unproven</p>
                  <p className="mt-1 font-jakarta text-xs leading-relaxed text-amber-800">
                    Buyer urgency and willingness to pay need customer research.
                  </p>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-bricolage text-sm font-bold text-gray-900">Decision history</p>
                  <TimerReset size={15} className="text-gray-500" />
                </div>
                <div className="space-y-3">
                  {decisionRows.map((row, index) => (
                    <div key={row.title} className="relative rounded-lg border border-black/6 bg-[#fbfaf7] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bricolage text-xs font-bold text-gray-900">{row.title}</p>
                          <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{row.detail}</p>
                        </div>
                        <span className="rounded-md border border-black/8 bg-white px-2 py-0.5 font-jakarta text-[10px] font-semibold text-gray-600">
                          {row.status}
                        </span>
                      </div>
                      {index < decisionRows.length - 1 && <div className="absolute -bottom-3 left-5 h-3 w-px bg-black/10" />}
                    </div>
                  ))}
                </div>
                <details className="mt-4 rounded-lg border border-black/6 bg-white p-3">
                  <summary className="cursor-pointer list-none font-bricolage text-xs font-bold text-gray-700">
                    Methodology preview
                  </summary>
                  <p className="mt-2 font-jakarta text-xs leading-relaxed text-gray-500">
                    Scores combine weighted components, source reliability, missing evidence, and confidence. Generated findings are labeled separately from verified evidence.
                  </p>
                </details>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-jakarta text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Source-backed findings</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="inline-flex items-center gap-1"><FileText size={12} /> Reports saved to workspace</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
