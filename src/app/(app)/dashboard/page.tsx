"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lightbulb, Swords, DollarSign, Brain, TrendingUp,
  Target, MessageSquare, Palette, ArrowRight, Zap,
  BarChart3, Users, TrendingDown, ClipboardList, Crown, ShieldCheck,
  Lock, SearchCheck,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import UsageWidget from "@/components/app/UsageWidget";
import SubscriptionStatusCard from "@/components/app/SubscriptionStatusCard";
import RecentReports from "@/components/app/RecentReports";
import { getAuthHeaders } from "@/lib/auth-headers-client";

interface FounderProfile {
  startup_idea: string;
  product_summary: string;
  target_audience: string;
  industry?: string | null;
  founder_stage?: string | null;
  region?: string | null;
  primary_goal?: string | null;
}

interface UsageSummary {
  plan: "free" | "founder" | "growth" | "scale";
}

const engines = [
  { icon: SearchCheck, title: "Evidence Engine", description: "Create an evidence-backed assessment project with transparent scores.", href: "/evidence-engine", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.16)", badge: "PRIMARY" },
  { icon: Lightbulb, title: "Idea & Market Engine", description: "Assess idea clarity, target customer, and demand assumptions.", href: "/idea-engine", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.16)", badge: null },
  { icon: Swords, title: "Competitor Intelligence", description: "Map competitors, find weaknesses, exploit gaps.", href: "/competitor-intelligence", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.16)", badge: null },
  { icon: DollarSign, title: "Revenue Engine", description: "Pricing strategy, conversion blockers, monetization.", href: "/revenue-engine", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.16)", badge: null },
  { icon: Brain, title: "User Psychology Engine", description: "Trust score, UX roast, friction points, fixes.", href: "/user-psychology", color: "#f43f5e", bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.16)", badge: null },
  { icon: TrendingUp, title: "Growth Engine", description: "First 10 customers, channels, outreach direction.", href: "/growth-engine", color: "#2563eb", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.16)", badge: null },
  { icon: Target, title: "Founder Decision Engine", description: "Priorities, strategy, confidence score, action brief.", href: "/founder-decision", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.16)", badge: null },
  { icon: MessageSquare, title: "ColdDM", description: "Draft WhatsApp, LinkedIn, and email outreach.", href: "/cold-dm", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.16)", badge: "HOT" },
  { icon: Palette, title: "BrandForge", description: "Names, taglines, positioning, brand personality.", href: "/brand-forge", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.16)", badge: "NEW" },
];

const stats = [
  { label: "Evidence Workflow", value: "1", icon: SearchCheck, color: "#059669", sub: "Assessment project" },
  { label: "Assessment Tools", value: "6", icon: BarChart3, color: "#10b981", sub: "Full founder stack" },
  { label: "Revenue Tools", value: "2", icon: Zap, color: "#f59e0b", sub: "Outreach + Branding" },
  { label: "Assessment Flow", value: "~15s", icon: TrendingUp, color: "#2563eb", sub: "Structured review" },
  { label: "Score Components", value: "48+", icon: Users, color: "#7c3aed", sub: "Signals per run" },
];

const tips = [
  "Start with the Evidence Engine to assess your core assumptions first.",
  "Run the Competitor Intelligence Engine before finalizing your positioning.",
  "Use ColdDM after the Growth Engine for aligned outreach messaging.",
  "The Founder Decision Engine works best with context from all other engines.",
  "BrandForge is strongest after you have evidence for your ICP.",
];

export default function DashboardPage() {
  const [profile, setProfile] = useState<FounderProfile | null>(null);
  const [usage, setUsage] = useState<UsageSummary>({ plan: "free" });

  useEffect(() => {
    async function loadDashboardState() {
      try {
        const headers = await getAuthHeaders();
        const [profileRes, usageRes] = await Promise.all([
          fetch("/api/founder-profile", { headers }),
          fetch("/api/check-usage", { headers }),
        ]);

        const profileData = await profileRes.json();
        if (profileRes.ok && profileData.profile) setProfile(profileData.profile);

        const usageData = await usageRes.json();
        if (usageRes.ok && usageData.plan) setUsage({ plan: usageData.plan });
      } catch {
        // best-effort personalization
      }
    }

    loadDashboardState();
  }, []);

  const premiumStarterLocks = new Set([
    "/revenue-engine",
    "/user-psychology",
    "/growth-engine",
    "/founder-decision",
  ]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">

      <AnimatedSection className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">
              {profile?.startup_idea ? `Command Center for ${profile.startup_idea}` : "Founder Command Center"}
            </h1>
            <p className="font-jakarta text-sm text-gray-500">
              {profile?.primary_goal
                ? `Your current goal: ${profile.primary_goal}. Review the evidence before you build.`
                : "Assess your startup or SaaS assumptions using visible evidence before you build."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/payment?plan=founder&billing=monthly">
              <button className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white font-bricolage text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 transition-colors">
                <Crown size={13} />
                Upgrade plan
              </button>
            </Link>
            <Link href="/onboarding">
              <button className="h-9 px-3.5 rounded-xl border border-black/8 bg-white text-gray-700 font-bricolage text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                <ClipboardList size={13} />
                Edit context
              </button>
            </Link>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-jakarta text-xs font-semibold text-emerald-700">Assessment tools ready</span>
            </div>
          </div>
        </div>
      </AnimatedSection>

      <StaggerContainer className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6" staggerDelay={0.06}>
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

      <AnimatedSection className="mb-10" delay={0.08}>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-emerald-500" />
          <h2 className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-widest">
            Your Plan & Usage
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UsageWidget />
          <SubscriptionStatusCard />
        </div>
      </AnimatedSection>

      <AnimatedSection className="mb-10" delay={0.1}>
        <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={15} className="text-emerald-500" />
                <h2 className="font-bricolage text-sm font-bold text-gray-900">Recommended next moves</h2>
              </div>
              <p className="font-jakarta text-sm text-gray-500">
                Not sure where to start? Choose the workflow that matches today&apos;s founder decision.
              </p>
            </div>
            <Link href="/evidence-engine">
              <button className="h-10 px-4 rounded-xl border border-black/8 font-bricolage text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                Start Evidence Engine <ArrowRight size={13} />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "Create evidence project", description: "Score the idea using evidence, confidence, and uncertainty.", href: "/evidence-engine", icon: SearchCheck, color: "#059669" },
              { title: "Find your positioning gap", description: "Use this before writing copy, choosing a niche, or launching ads.", href: "/competitor-intelligence", icon: Swords, color: "#f59e0b" },
              { title: "Prepare outreach", description: "Turn your offer into WhatsApp, LinkedIn, and email messages.", href: "/cold-dm", icon: MessageSquare, color: "#10b981" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="h-full rounded-xl border border-black/6 bg-gray-50 p-4 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${item.color}12`, border: `1px solid ${item.color}22` }}>
                      <Icon size={14} style={{ color: item.color }} />
                    </div>
                    <p className="font-bricolage text-sm font-bold text-gray-900 mb-1">{item.title}</p>
                    <p className="font-jakarta text-xs text-gray-500 leading-relaxed">{item.description}</p>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-emerald-500" />
          <h2 className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-widest">
            Assessment Tools
          </h2>
        </div>
      </AnimatedSection>

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10" staggerDelay={0.05}>
        {engines.map((engine) => {
          const Icon = engine.icon;
          const locked = usage.plan === "free" && premiumStarterLocks.has(engine.href);
          const href = locked ? "/payment?plan=founder&billing=monthly" : engine.href;
          return (
            <StaggerItem key={engine.href}>
              <Link href={href}>
                <motion.div
                  whileHover={{ y: -3, scale: 1.01 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`group rounded-2xl border bg-white p-5 hover:shadow-md transition-all duration-200 cursor-pointer h-full flex flex-col gap-3 ${locked ? "opacity-85" : ""}`}
                  style={{ borderColor: engine.border }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: engine.bg, border: `1px solid ${engine.border}` }}
                    >
                      <Icon size={16} style={{ color: engine.color }} />
                    </div>
                    {locked ? (
                      <span className="inline-flex items-center gap-1 font-jakarta text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Lock size={9} />
                        Founder
                      </span>
                    ) : engine.badge && (
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
                    {locked ? "Upgrade" : "Run"} <ArrowRight size={11} />
                  </div>
                </motion.div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      <AnimatedSection className="mb-10" delay={0.12}>
        <RecentReports />
      </AnimatedSection>

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
                { step: "01", label: "Evidence Engine", desc: "Create the evidence-backed project", href: "/evidence-engine", color: "#059669" },
                { step: "02", label: "Idea & Market Engine", desc: "Deepen demand and ICP assessment", href: "/idea-engine", color: "#10b981" },
                { step: "03", label: "Competitor Intelligence", desc: "Know your battlefield", href: "/competitor-intelligence", color: "#f59e0b" },
                { step: "04", label: "Revenue Engine", desc: "Set the right price", href: "/revenue-engine", color: "#059669" },
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

