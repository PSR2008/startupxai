"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lightbulb, Swords, DollarSign, Brain, TrendingUp,
  Target, MessageSquare, Palette, ArrowRight, Zap,
  BarChart3, Users, TrendingDown, Sparkles,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

const engines = [
  { icon: Lightbulb, title: "Idea & Market Engine", description: "Validate idea viability, market demand, and ICP.", href: "/idea-engine", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.16)", badge: null },
  { icon: Swords, title: "Competitor Intelligence", description: "Map competitors, find weaknesses, exploit gaps.", href: "/competitor-intelligence", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.16)", badge: null },
  { icon: DollarSign, title: "Revenue Engine", description: "Pricing strategy, conversion blockers, monetization.", href: "/revenue-engine", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.16)", badge: null },
  { icon: Brain, title: "User Psychology Engine", description: "Trust score, UX roast, friction points, fixes.", href: "/user-psychology", color: "#f43f5e", bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.16)", badge: null },
  { icon: TrendingUp, title: "Growth Engine", description: "First 10 customers, channels, outreach direction.", href: "/growth-engine", color: "#2563eb", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.16)", badge: null },
  { icon: Target, title: "Founder Decision Engine", description: "Priorities, strategy, confidence score, action brief.", href: "/founder-decision", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.16)", badge: null },
  { icon: MessageSquare, title: "ColdDM AI", description: "Generate WhatsApp, LinkedIn, and email outreach.", href: "/cold-dm", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.16)", badge: "HOT" },
  { icon: Palette, title: "BrandForge AI", description: "Names, taglines, positioning, brand personality.", href: "/brand-forge", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.16)", badge: "NEW" },
];

const stats = [
  { label: "Intelligence Engines", value: "6", icon: BarChart3, color: "#10b981", sub: "Full founder stack" },
  { label: "Revenue Tools", value: "2", icon: Zap, color: "#f59e0b", sub: "Outreach + Branding" },
  { label: "Avg. Analysis Time", value: "~15s", icon: TrendingUp, color: "#2563eb", sub: "Powered by Claude" },
  { label: "Analysis Categories", value: "48+", icon: Users, color: "#7c3aed", sub: "Data points per run" },
];

const tips = [
  "Start with the Idea & Market Engine to validate your core assumptions first.",
  "Run the Competitor Intelligence Engine before finalizing your positioning.",
  "Use ColdDM AI after the Growth Engine for aligned outreach messaging.",
  "The Founder Decision Engine works best with context from all other engines.",
  "BrandForge AI is most powerful when you've already validated your ICP.",
];

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Welcome header */}
      <AnimatedSection className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">
              Founder Command Center
            </h1>
            <p className="font-jakarta text-sm text-gray-500">
              Six intelligence engines. Two revenue tools. One platform. Let&apos;s build.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700">AI Engines Online</span>
          </div>
        </div>
      </AnimatedSection>

      {/* Stats */}
      <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" staggerDelay={0.06}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <StaggerItem key={stat.label}>
              <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${stat.color}12`, border: `1px solid ${stat.color}22` }}
                  >
                    <Icon size={14} style={{ color: stat.color }} />
                  </div>
                </div>
                <p className="font-bricolage text-3xl font-bold mb-0.5" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="font-bricolage text-xs font-bold text-gray-800">{stat.label}</p>
                <p className="font-jakarta text-xs text-gray-400 mt-0.5">{stat.sub}</p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Engine grid header */}
      <AnimatedSection className="mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-500" />
          <h2 className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-widest">
            Intelligence Engines
          </h2>
        </div>
      </AnimatedSection>

      {/* Engine grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10" staggerDelay={0.05}>
        {engines.map((engine) => {
          const Icon = engine.icon;
          return (
            <StaggerItem key={engine.href}>
              <Link href={engine.href}>
                <motion.div
                  whileHover={{ y: -3, scale: 1.01 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="group rounded-2xl border bg-white p-5 hover:shadow-md transition-all duration-200 cursor-pointer h-full flex flex-col gap-3"
                  style={{ borderColor: engine.border }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: engine.bg, border: `1px solid ${engine.border}` }}
                    >
                      <Icon size={16} style={{ color: engine.color }} />
                    </div>
                    {engine.badge && (
                      <span className="font-jakarta text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                        {engine.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bricolage text-sm font-bold text-gray-900 mb-1.5 group-hover:text-black transition-colors">
                      {engine.title}
                    </h3>
                    <p className="font-jakarta text-xs text-gray-500 leading-relaxed">
                      {engine.description}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 font-bricolage text-xs font-semibold group-hover:gap-2 transition-all"
                    style={{ color: engine.color }}
                  >
                    Run <ArrowRight size={11} />
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recommended workflow */}
        <AnimatedSection className="lg:col-span-2" delay={0.1}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingDown size={15} className="text-emerald-500" />
              <h3 className="font-bricolage text-sm font-bold text-gray-900">
                Recommended Founder Workflow
              </h3>
            </div>
            <div className="space-y-2">
              {[
                { step: "01", label: "Idea & Market Engine", desc: "Validate before everything", href: "/idea-engine", color: "#10b981" },
                { step: "02", label: "Competitor Intelligence", desc: "Know your battlefield", href: "/competitor-intelligence", color: "#f59e0b" },
                { step: "03", label: "Revenue Engine", desc: "Set the right price", href: "/revenue-engine", color: "#059669" },
                { step: "04", label: "User Psychology Engine", desc: "Fix trust before launch", href: "/user-psychology", color: "#f43f5e" },
                { step: "05", label: "Growth Engine", desc: "Get your first customers", href: "/growth-engine", color: "#2563eb" },
                { step: "06", label: "Founder Decision Engine", desc: "Final strategic clarity", href: "/founder-decision", color: "#7c3aed" },
              ].map((item, i) => (
                <Link key={item.step} href={item.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <span
                      className="font-mono text-xs font-bold w-6 flex-shrink-0"
                      style={{ color: item.color }}
                    >
                      {item.step}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bricolage text-sm font-semibold text-gray-900 group-hover:text-black transition-colors">
                        {item.label}
                      </p>
                      <p className="font-jakarta text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Pro tips */}
        <AnimatedSection delay={0.15}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 h-full shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Zap size={15} className="text-amber-500" />
              <h3 className="font-bricolage text-sm font-bold text-gray-900">Founder Tips</h3>
            </div>
            <div className="space-y-4">
              {tips.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-bricolage text-[9px] font-bold text-amber-600">{i + 1}</span>
                  </span>
                  <p className="font-jakarta text-xs text-gray-500 leading-relaxed">{tip}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
