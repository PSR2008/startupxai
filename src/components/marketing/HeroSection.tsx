"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, Zap, TrendingUp, Target, Brain, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";

const floatingCards = [
  {
    icon: Target,
    label: "Market Demand Score",
    value: "87/100",
    sub: "High commercial viability",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.20)",
    position: "top-[15%] left-[4%]",
    delay: 0,
  },
  {
    icon: TrendingUp,
    label: "Fastest Path to Traction",
    value: "LinkedIn + Cold Email",
    sub: "Growth strategy identified",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.08)",
    border: "rgba(124,58,237,0.20)",
    position: "top-[20%] right-[3%]",
    delay: 0.15,
  },
  {
    icon: Brain,
    label: "Trust Score",
    value: "64/100",
    sub: "3 friction points found",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.22)",
    position: "bottom-[28%] left-[2%]",
    delay: 0.3,
  },
  {
    icon: Zap,
    label: "Revenue Recommendation",
    value: "₹49 / ₹149 / custom",
    sub: "Optimal pricing tiers",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.20)",
    position: "bottom-[30%] right-[2%]",
    delay: 0.2,
  },
];

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[100svh] flex flex-col items-center justify-center pt-24 pb-20 overflow-hidden hero-mesh"
    >
      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" />

      {/* Soft edge vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 120% 80% at 50% 50%, transparent 40%, rgba(247,248,252,0.6) 100%)" }}
      />

      {/* Floating cards */}
      {floatingCards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1 + card.delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute hidden xl:flex flex-col gap-1.5 w-52 p-4 rounded-2xl border ${card.position}`}
            style={{
              background: card.bg,
              borderColor: card.border,
              backdropFilter: "blur(16px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.8)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: card.bg, border: `1px solid ${card.border}` }}
              >
                <Icon size={12} style={{ color: card.color }} />
              </div>
              <span className="font-jakarta text-[10px] font-semibold text-gray-500 leading-tight">
                {card.label}
              </span>
            </div>
            <p className="font-bricolage text-sm font-bold leading-tight" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className="font-jakarta text-[10px] text-gray-400">{card.sub}</p>
          </motion.div>
        );
      })}

      {/* Main content */}
      <motion.div
        style={{ y, opacity }}
        className="relative z-10 flex flex-col items-center text-center px-5 max-w-5xl"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 mb-8"
        >
          <Sparkles size={12} className="text-emerald-500" />
          <span className="font-jakarta text-xs font-semibold text-emerald-700">
            Built for the next generation of founders
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-bricolage font-bold text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] leading-[1.08] tracking-tight mb-6 text-gray-900"
        >
          Your AI{" "}
          <span className="text-gradient-brand">Co-Founder</span>
          <br />
          for Serious{" "}
          <span className="text-gradient-violet">Founders</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="font-jakarta text-lg sm:text-xl text-gray-500 max-w-2xl leading-relaxed mb-10"
        >
          Validate ideas. Crush competitors. Unlock revenue. Decode user psychology.
          Accelerate growth. All in one intelligence platform —
          <span className="text-gray-800 font-semibold"> powered by AI, built for founders</span>.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link href="/dashboard">
            <Button size="xl" icon={<ArrowRight size={18} />} iconPosition="right">
              Start Analyzing Free
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="xl">
              View pricing
            </Button>
          </Link>
        </motion.div>

        {/* Trust */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="mt-6 font-jakarta text-xs text-gray-400"
        >
          No credit card required · 6 intelligence engines · Results in seconds
        </motion.p>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 w-full max-w-4xl"
        >
          <div className="relative rounded-2xl border border-black/8 overflow-hidden shadow-2xl shadow-black/8 bg-white">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-black/6">
              <div className="flex gap-1.5">
                {["#f87171", "#fbbf24", "#34d399"].map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="px-8 py-1 rounded-md bg-white border border-black/8">
                  <span className="font-mono text-[10px] text-gray-400">
                    app.startupxai.com/dashboard
                  </span>
                </div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="bg-[#f7f8fc] p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Market Score", value: "87", color: "#10b981", bg: "rgba(16,185,129,0.08)" },
                  { label: "Trust Score", value: "64", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                  { label: "Idea Clarity", value: "91", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
                  { label: "Confidence", value: "78", color: "#2563eb", bg: "rgba(37,99,235,0.08)" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-black/6 bg-white p-3 text-center shadow-sm">
                    <p className="font-bricolage text-2xl font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </p>
                    <p className="font-jakarta text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Risk Factors", items: ["High acquisition cost", "Market fragmentation", "Low switching cost"], color: "#f43f5e" },
                  { label: "Opportunities", items: ["Enterprise segment untapped", "No premium tier in market", "LinkedIn audience underserved"], color: "#10b981" },
                  { label: "Next Actions", items: ["Fix trust signals first", "Launch LinkedIn outreach", "A/B test pricing page"], color: "#2563eb" },
                ].map((col) => (
                  <div key={col.label} className="rounded-xl border border-black/6 bg-white p-3 space-y-2 shadow-sm">
                    <p className="font-bricolage text-xs font-semibold text-gray-500">{col.label}</p>
                    {col.items.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: col.color }} />
                        <p className="font-jakarta text-[11px] text-gray-500 leading-tight">{item}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
