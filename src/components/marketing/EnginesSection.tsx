"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Lightbulb, Swords, DollarSign, Brain, TrendingUp,
  Target, MessageSquare, Palette, ArrowRight, CheckCircle2,
  Shield, Zap, Globe, BarChart3, Users, Sparkles,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import Button from "@/components/ui/Button";

// ============================================
// LOGO MARQUEE
// ============================================
const logos = [
  "Y Combinator", "Sequoia", "Andreessen", "Product Hunt",
  "TechCrunch", "IndieHackers", "AppSumo", "Stripe Atlas",
  "AWS Startups", "Google for Startups", "Notion", "Figma",
];

export function LogoMarquee() {
  return (
    <section className="py-14 border-y border-black/5 bg-white">
      <div className="container-custom mb-6">
        <p className="text-center font-jakarta text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Trusted by founders building at
        </p>
      </div>
      <div className="marquee-wrapper">
        <div className="flex animate-marquee whitespace-nowrap gap-0">
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={`${logo}-${i}`}
              className="inline-flex items-center justify-center px-7 py-2 mx-3 rounded-xl border border-black/6 bg-gray-50"
            >
              <span className="font-bricolage text-sm font-semibold text-gray-400 whitespace-nowrap">
                {logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// ENGINES SECTION
// ============================================
const engines = [
  {
    icon: Lightbulb,
    title: "Idea & Market Engine",
    description: "Score your idea's viability. Detect hidden risks, assumptions, and opportunities before you waste a single week building the wrong thing.",
    href: "/idea-engine",
    color: "#10b981",
    bg: "rgba(16,185,129,0.06)",
    border: "rgba(16,185,129,0.16)",
    outputs: ["Market Demand Score", "Risk Factors", "ICP Suggestions", "Differentiation"],
  },
  {
    icon: Swords,
    title: "Competitor Intelligence",
    description: "Map every competitor, find their weaknesses, and discover white-space opportunities they're completely ignoring.",
    href: "/competitor-intelligence",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.16)",
    outputs: ["Direct Competitors", "Positioning Gaps", "Beat Strategy", "White Space Map"],
  },
  {
    icon: DollarSign,
    title: "Revenue Engine",
    description: "Build a monetization strategy that converts. Get pricing tiers, conversion blockers, and psychological pricing recommendations.",
    href: "/revenue-engine",
    color: "#059669",
    bg: "rgba(5,150,105,0.06)",
    border: "rgba(5,150,105,0.16)",
    outputs: ["Pricing Tiers", "Revenue Leaks", "Conversion Blockers", "Upsell Strategy"],
  },
  {
    icon: Brain,
    title: "User Psychology Engine",
    description: "Brutal audit of your trust, UX, and copy. Understand exactly why users don't buy — and what to fix first.",
    href: "/user-psychology",
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.06)",
    border: "rgba(244,63,94,0.16)",
    outputs: ["Trust Score", "Brutal Roast", "Friction Points", "UX Fixes"],
  },
  {
    icon: TrendingUp,
    title: "Growth Engine",
    description: "Get your first 10 customers. Tactical channel recommendations, outreach direction, and a step-by-step launch playbook.",
    href: "/growth-engine",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.06)",
    border: "rgba(37,99,235,0.16)",
    outputs: ["10-Customer Plan", "Channel Stack", "Content Hooks", "Launch Steps"],
  },
  {
    icon: Target,
    title: "Founder Decision Engine",
    description: "Executive-level strategic guidance. Top priorities, what not to build, fastest path to traction, and a confidence score.",
    href: "/founder-decision",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.06)",
    border: "rgba(124,58,237,0.16)",
    outputs: ["Top 3 Priorities", "Strategic Mistakes", "Traction Path", "Confidence Score"],
  },
];

const revenueTools = [
  {
    icon: MessageSquare,
    title: "ColdDM AI",
    description: "Generate high-converting outreach messages for WhatsApp, LinkedIn, and email. Short, medium, long variants with follow-ups included.",
    href: "/cold-dm",
    color: "#10b981",
    badge: "HOT",
  },
  {
    icon: Palette,
    title: "BrandForge AI",
    description: "Generate startup names, taglines, positioning lines, brand personality, and a color direction — in seconds.",
    href: "/brand-forge",
    color: "#7c3aed",
    badge: "NEW",
  },
];

export function EnginesSection() {
  return (
    <section id="engines" className="py-24 px-5 bg-[#f7f8fc]">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 mb-5">
            <Sparkles size={12} className="text-emerald-500" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              The Intelligence Stack
            </span>
          </div>
          <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            Six engines. One mission.{" "}
            <span className="text-gradient-brand">Your success.</span>
          </h2>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Each engine is purpose-built to answer the questions that kill startups —
            before they have a chance to kill yours.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16" staggerDelay={0.07}>
          {engines.map((engine) => {
            const Icon = engine.icon;
            return (
              <StaggerItem key={engine.href}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full"
                >
                  <Link href={engine.href} className="block h-full">
                    <div
                      className="h-full rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-200 hover:shadow-lg cursor-pointer group bg-white"
                      style={{ borderColor: engine.border }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: engine.bg, border: `1px solid ${engine.border}` }}
                      >
                        <Icon size={18} style={{ color: engine.color }} />
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bricolage text-base font-bold text-gray-900 mb-2 group-hover:text-black transition-colors">
                          {engine.title}
                        </h3>
                        <p className="font-jakarta text-sm text-gray-500 leading-relaxed">
                          {engine.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {engine.outputs.map((output) => (
                          <span
                            key={output}
                            className="font-jakarta text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              color: engine.color,
                              borderColor: `${engine.color}30`,
                              background: engine.bg,
                            }}
                          >
                            {output}
                          </span>
                        ))}
                      </div>

                      <div
                        className="flex items-center gap-1.5 font-bricolage text-sm font-semibold group-hover:gap-2.5 transition-all"
                        style={{ color: engine.color }}
                      >
                        Run analysis
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        <AnimatedSection delay={0.1}>
          <div className="separator mb-10" />
          <p className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-8">
            Revenue Tools
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {revenueTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={tool.href}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-black/6 bg-white p-6 hover:border-emerald-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${tool.color}10`, border: `1px solid ${tool.color}25` }}
                      >
                        <Icon size={18} style={{ color: tool.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-bricolage text-base font-bold text-gray-900">
                            {tool.title}
                          </h3>
                          <span className="font-jakarta text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            {tool.badge}
                          </span>
                        </div>
                        <p className="font-jakarta text-sm text-gray-500 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================
// FEATURES SECTION
// ============================================
const features = [
  { icon: Zap, title: "Results in under 30 seconds", description: "No waiting, no queues. Get founder-grade intelligence instantly.", color: "#f59e0b" },
  { icon: Shield, title: "Security-hardened by design", description: "Rate limiting, input validation, secure API handling. Built like a real product.", color: "#10b981" },
  { icon: Globe, title: "Built for global markets", description: "Region-aware analysis that understands local market dynamics.", color: "#2563eb" },
  { icon: BarChart3, title: "Structured, scored outputs", description: "Not vague AI text. Scored outputs, risk ratings, and actionable recommendations.", color: "#7c3aed" },
  { icon: Users, title: "Designed for solo founders", description: "Gives you a full team's perspective — market, product, growth, sales.", color: "#f43f5e" },
  { icon: CheckCircle2, title: "Actionable, not theoretical", description: "Every output tells you what to DO next. No consultant fluff.", color: "#059669" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-5 bg-white">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-200 bg-violet-50 mb-5">
            <span className="font-jakarta text-xs font-semibold text-violet-700 uppercase tracking-wide">
              Why StartupX AI
            </span>
          </div>
          <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            Not your average{" "}
            <span className="text-gradient-violet">AI tool</span>
          </h2>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto">
            Built with the same rigor you&apos;d expect from a senior founding team,
            not a weekend side project.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="rounded-2xl border border-black/6 bg-[#f7f8fc] p-6 hover:border-black/10 hover:bg-white hover:shadow-sm transition-all duration-200">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}10`, border: `1px solid ${f.color}25` }}
                  >
                    <Icon size={17} style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bricolage text-sm font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="font-jakarta text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ============================================
// TESTIMONIALS SECTION
// ============================================
const testimonials = [
  {
    quote: "I ran my SaaS idea through StartupX AI in 15 minutes. It found 3 competitor weaknesses I missed and gave me a pricing strategy that doubled my trial conversion.",
    name: "Aditya Sharma", role: "Founder, Taskly", initials: "AS", color: "#10b981",
  },
  {
    quote: "The Competitor Intelligence engine is genuinely impressive. It found positioning gaps my $2,000/month consultant missed. This is the co-founder I couldn't afford.",
    name: "Priya Menon", role: "Founder, FinanceAI", initials: "PM", color: "#7c3aed",
  },
  {
    quote: "ColdDM AI alone is worth the subscription. I sent 40 LinkedIn messages, got 12 replies, and closed 3 pilot customers in week one.",
    name: "Marcus Chen", role: "Founder, LeadFlow", initials: "MC", color: "#2563eb",
  },
  {
    quote: "The User Psychology Engine gave us a brutal but accurate roast of our landing page. We implemented 4 recommendations and our bounce rate dropped 32%.",
    name: "Fatima Al-Rashid", role: "Co-Founder, EdTech.io", initials: "FA", color: "#f59e0b",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 px-5 bg-[#f7f8fc]">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-200 bg-amber-50 mb-5">
            <span className="font-jakarta text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Founder Stories
            </span>
          </div>
          <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Founders who shipped faster
          </h2>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5" staggerDelay={0.1}>
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="rounded-2xl border border-black/6 bg-white p-7 space-y-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="font-jakarta text-sm text-gray-600 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-1 border-t border-black/5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bricolage text-xs font-bold text-white flex-shrink-0"
                    style={{ background: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-bricolage text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="font-jakarta text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ============================================
// PRICING SECTION
// ============================================
const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "For founders exploring the platform",
    features: ["3 analyses per day", "Idea & Market Engine", "Growth Engine (basic)", "ColdDM AI (3/day)", "Community support"],
    cta: "Start Free",
    href: "/dashboard",
    highlighted: false,
  },
  {
    name: "Founder",
    price: "₹49",
    period: "/month",
    description: "For founders building seriously",
    features: ["Unlimited analyses", "All 6 Intelligence Engines", "ColdDM AI (unlimited)", "BrandForge AI (unlimited)", "Priority AI processing", "PDF report exports", "Email support"],
    cta: "Start 7-Day Free Trial",
    href: "/payment?plan=founder",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Studio",
    price: "₹1,499",
    period: "/month",
    description: "For founders and small teams",
    features: ["Everything in Founder", "3 team seats", "Saved analysis history", "API access (coming soon)", "Custom brand voice", "Slack support", "Dedicated onboarding"],
    cta: "Start 7-Day Free Trial",
    href: "/payment?plan=studio",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-5 bg-white">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 mb-5">
            <span className="font-jakarta text-xs font-semibold text-blue-700 uppercase tracking-wide">
              Simple Pricing
            </span>
          </div>
          <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Invest in your startup,{" "}
            <span className="text-gradient-brand">not consultants</span>
          </h2>
          <p className="font-jakarta text-lg text-gray-500 max-w-lg mx-auto">
            One platform. All six engines. The intelligence you need at a fraction of what agencies charge.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto" staggerDelay={0.1}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <div
                className={`relative h-full rounded-2xl border p-7 flex flex-col transition-all duration-200 ${
                  plan.highlighted
                    ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white shadow-lg shadow-emerald-100"
                    : "border-black/6 bg-[#f7f8fc] hover:bg-white hover:shadow-sm"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="font-bricolage text-[10px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/30">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="font-bricolage text-sm font-bold text-gray-500 mb-3">{plan.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="font-bricolage text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && (
                      <span className="font-jakarta text-sm text-gray-400 mb-1.5">{plan.period}</span>
                    )}
                  </div>
                  <p className="font-jakarta text-sm text-gray-500">{plan.description}</p>
                </div>

                <div className="flex-1 space-y-2.5 mb-7">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="font-jakarta text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>

                <Link href={plan.href}>
                  <Button fullWidth variant={plan.highlighted ? "primary" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.2} className="text-center mt-10">
          <p className="font-jakarta text-sm text-gray-400">
            All plans include 7-day money-back guarantee · Cancel anytime · No hidden fees
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================
// CTA SECTION
// ============================================
export function CTASection() {
  return (
    <section className="py-24 px-5 bg-[#f7f8fc]">
      <div className="container-custom">
        <AnimatedSection>
          <div className="relative rounded-3xl overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600" />
            <div className="absolute inset-0 dot-pattern opacity-20" />
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-teal-400/20 blur-3xl translate-y-1/2 -translate-x-1/4" />

            <div className="relative p-12 sm:p-16 text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/30 bg-white/15 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="font-jakarta text-xs font-semibold text-white uppercase tracking-wide">
                  Ready to build smarter?
                </span>
              </div>
              <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
                Your AI co-founder is waiting
              </h2>
              <p className="font-jakarta text-lg text-emerald-100 max-w-lg mx-auto mb-10 leading-relaxed">
                Join thousands of founders who validate faster, ship smarter,
                and grow with confidence using StartupX AI.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-14 px-8 rounded-2xl bg-white text-emerald-700 font-bricolage font-bold text-base shadow-lg shadow-black/8 hover:shadow-xl hover:shadow-black/8 transition-shadow flex items-center gap-2"
                  >
                    Start Analyzing Free <ArrowRight size={18} />
                  </motion.button>
                </Link>
                <Link href="/pricing">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-14 px-8 rounded-2xl border-2 border-white/40 text-white font-bricolage font-semibold text-base hover:bg-white/10 transition-colors"
                  >
                    See all plans
                  </motion.button>
                </Link>
              </div>
              <p className="mt-6 font-jakarta text-sm text-emerald-200">
                Free to start · No credit card required · Results in 30 seconds
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
