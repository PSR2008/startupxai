"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, BarChart3, CheckCircle2, FileText, ShieldCheck, Target, TrendingUp, Zap } from "lucide-react";
import Button from "@/components/ui/Button";

const operatingMetrics = [
  { label: "Evidence score", value: "91", color: "#2563eb" },
  { label: "Evidence quality", value: "87", color: "#059669" },
  { label: "Trust risk", value: "64", color: "#d97706" },
  { label: "Go-to-market", value: "78", color: "#7c3aed" },
];

const decisionRows = [
  { title: "Assess demand", status: "Evidence needed", detail: "Narrow ICP with clear budget pain" },
  { title: "Review positioning", status: "Needs evidence", detail: "Landing page lacks proof and urgency" },
  { title: "Plan outreach", status: "Ready to test", detail: "Start with founder-led LinkedIn outreach" },
];

const workflowItems = [
  { icon: Target, label: "Evidence assessment", detail: "Demand, ICP, assumptions" },
  { icon: BarChart3, label: "Revenue strategy", detail: "Pricing, leaks, conversion" },
  { icon: FileText, label: "Execution output", detail: "Reports, next steps, exports" },
];

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const opacity = useTransform(scrollYProgress, [0, 0.78], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[94svh] overflow-hidden border-b border-black/6 bg-[#f7f8fc] pt-24 pb-12"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-black/10" />

      <motion.div
        style={{ y, opacity }}
        className="container-custom relative grid min-h-[calc(94svh-9rem)] grid-cols-1 items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]"
      >
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="mb-7 inline-flex items-center gap-2 rounded-lg border border-black/8 bg-white px-3 py-1.5 shadow-sm"
          >
            <ShieldCheck size={13} className="text-emerald-600" />
            <span className="font-jakarta text-xs font-semibold text-gray-600">
              Founder operating system for early decisions
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 font-bricolage text-5xl font-bold leading-[1.04] tracking-tight text-gray-950 sm:text-6xl lg:text-7xl"
          >
            Make startup decisions with evidence, not guesswork.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.55 }}
            className="mb-9 max-w-xl font-jakarta text-lg leading-relaxed text-gray-600"
          >
            StartupX AI helps founders assess assumptions, review evidence, compare competitors, pressure-test pricing, and plan next validation actions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mb-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link href="/signup?next=/evidence-engine">
              <Button size="xl" icon={<ArrowRight size={18} />} iconPosition="right">
                Start evidence assessment
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="xl">
                Compare plans
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {workflowItems.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="rounded-xl border border-black/6 bg-white p-4 shadow-sm">
                <Icon size={15} className="mb-3 text-gray-700" />
                <p className="font-bricolage text-xs font-bold text-gray-900">{label}</p>
                <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-400">{detail}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between border-b border-black/6 bg-white px-5 py-4">
              <div>
                <p className="font-bricolage text-sm font-bold text-gray-900">Evidence brief</p>
                <p className="font-jakarta text-xs text-gray-400">SaaS pricing evidence review</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="font-jakarta text-[11px] font-semibold text-emerald-700">Evidence review</span>
              </div>
            </div>

            <div className="bg-[#fbfcfe] p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {operatingMetrics.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-black/6 bg-white p-3">
                    <p className="font-bricolage text-2xl font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="mt-1 font-jakarta text-[11px] font-medium text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-lg border border-black/6 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-bricolage text-sm font-bold text-gray-900">Priority board</p>
                    <TrendingUp size={15} className="text-emerald-600" />
                  </div>
                  <div className="space-y-3">
                    {decisionRows.map((row) => (
                      <div key={row.title} className="rounded-lg border border-black/6 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-bricolage text-xs font-bold text-gray-800">{row.title}</p>
                          <span className="rounded-md border border-black/8 bg-white px-2 py-0.5 font-jakarta text-[10px] font-semibold text-gray-600">
                            {row.status}
                          </span>
                        </div>
                        <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{row.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-black/6 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" />
                    <p className="font-bricolage text-sm font-bold text-gray-900">Next actions</p>
                  </div>
                  <div className="space-y-3">
                    {["Add proof above pricing", "Test $10 Growth tier", "Ship 25-founder outreach batch", "Export report for weekly review"].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                        <p className="font-jakarta text-xs leading-relaxed text-gray-600">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-jakarta text-xs text-gray-400">
            <span>Free to start</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span>USD pricing</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span>Reports saved to your workspace</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
