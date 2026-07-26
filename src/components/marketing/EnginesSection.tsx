"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Lightbulb, Swords, DollarSign, Brain, TrendingUp,
  Target, MessageSquare, Palette, ArrowRight, CheckCircle2,
  Shield, Zap, Globe, BarChart3, Users, SearchCheck, FileText, Lock, Scale,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import Button from "@/components/ui/Button";
import { PLANS } from "@/lib/plans";

// ============================================
// LOGO MARQUEE
// ============================================
const logos = [
  "Evidence", "Positioning", "Pricing", "Growth",
  "Outreach", "Branding", "Psychology", "Competition",
  "Launch", "Retention", "Revenue", "Strategy",
];

export function LogoMarquee() {
  return (
    <section className="border-y border-black/8 bg-[#fffefa] py-14">
      <div className="container-custom mb-6">
        <p className="text-center font-jakarta text-xs font-semibold text-gray-500">
          Strategy areas covered
        </p>
      </div>
      <div className="marquee-wrapper">
        <div className="flex animate-marquee whitespace-nowrap gap-0">
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={`${logo}-${i}`}
              className="mx-3 inline-flex items-center justify-center rounded-lg border border-black/8 bg-[#f8f6f0] px-7 py-2"
            >
              <span className="whitespace-nowrap font-jakarta text-sm font-semibold text-gray-500">
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
// EVIDENCE TRANSPARENCY SECTIONS
// ============================================
const evidenceEntryCards = [
  {
    title: "Founder-provided evidence",
    description: "Interview notes, surveys, observations and research.",
    label: "Founder provided",
  },
  {
    title: "Linked sources",
    description: "URLs, articles and competitor pages added by the founder.",
    label: "Public URL",
  },
  {
    title: "Experiment results",
    description: "Landing-page tests, outreach results, sign-ups and customer responses.",
    label: "Experiment result",
  },
  {
    title: "AI-assisted suggestions",
    description: "Possible claims and research directions that remain unverified until evidence is attached.",
    label: "AI suggestion — unverified",
  },
];

export function EvidenceEntrySection() {
  return (
    <section className="editorial-section bg-[#fffefa] px-5 py-20">
      <div className="container-custom">
        <AnimatedSection className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-1.5">
            <SearchCheck size={12} className="text-emerald-600" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700">Evidence intake</span>
          </div>
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            How evidence enters your workspace
          </h2>
          <p className="font-jakarta text-lg leading-relaxed text-gray-600">
            StartupX AI organizes evidence founders add from customer discovery, research, source links and experiments. Generated suggestions stay separate until proof is attached.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" staggerDelay={0.06}>
          {evidenceEntryCards.map((card) => (
            <StaggerItem key={card.title}>
              <div className="surface-panel h-full p-6">
                <span className="mb-5 inline-flex rounded-md border border-black/8 bg-[#f8f6f0] px-2.5 py-1 font-mono text-[10px] font-semibold text-gray-600">
                  {card.label}
                </span>
                <h3 className="mb-2 font-bricolage text-base font-bold text-gray-900">{card.title}</h3>
                <p className="font-jakarta text-sm leading-relaxed text-gray-500">{card.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.1} className="mt-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
            <p className="font-jakarta text-sm leading-relaxed text-emerald-900">
              StartupX AI does not secretly scrape private information. Founder-provided and imported evidence remains clearly attributed.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

export function RealWorkflowSection() {
  const rows = [
    { label: "Assumption", value: "Operations leads urgently need better pricing review workflows.", status: "Unresolved claim" },
    { label: "Supporting evidence", value: "Interview note from founder discovery call", status: "Customer interview · supporting · May 2026" },
    { label: "Contradicting evidence", value: "Two prospects said spreadsheets are still acceptable", status: "Founder provided · contradicting · May 2026" },
    { label: "Source attribution", value: "Founder notes and imported competitor URL", status: "Imported source · reviewed" },
    { label: "Experiment", value: "Landing-page CTA test for pricing audit offer", status: "Experiment result · inconclusive" },
    { label: "Decision", value: "Interview five more buyers before changing pricing page", status: "Decision recorded" },
  ];

  return (
    <section className="editorial-section bg-[var(--color-bg-primary)] px-5 py-20">
      <div className="container-custom">
        <AnimatedSection className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-1.5">
              <FileText size={12} className="text-blue-600" />
              <span className="font-jakarta text-xs font-semibold text-blue-700">Product workflow</span>
            </div>
            <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
              A real evidence workflow—not a generated startup report.
            </h2>
          </div>
          <p className="font-jakarta text-lg leading-relaxed text-gray-600">
            The workspace connects claims to evidence, marks contradictions, records experiments and preserves the decision that followed. The example below is illustrative and does not represent customer data.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="surface-panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-black/8 bg-[#f8f6f0] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bricolage text-base font-bold text-gray-900">Example assessment</p>
                <p className="font-jakarta text-sm text-gray-500">SaaS pricing assessment · illustrative workflow</p>
              </div>
              <Link href="/methodology" className="font-jakarta text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                How assessments are calculated
              </Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-black/8 p-6 lg:border-b-0 lg:border-r">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Evidence Score</p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="font-bricolage text-5xl font-bold text-gray-950">62</span>
                  <span className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-jakarta text-xs font-semibold text-amber-700">
                    Medium confidence
                  </span>
                </div>
                <p className="mt-4 font-jakarta text-sm leading-relaxed text-gray-600">
                  This score reflects the evidence currently available. It does not prove market demand or guarantee business success.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-2">
                  {["2 supporting items", "1 contradicting item", "1 completed experiment", "Missing: more buyer interviews"].map((item) => (
                    <div key={item} className="rounded-lg border border-black/8 bg-white px-3 py-2 font-jakarta text-sm text-gray-600">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-black/6">
                {rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-[0.35fr_1fr]">
                    <p className="font-bricolage text-sm font-bold text-gray-900">{row.label}</p>
                    <div>
                      <p className="font-jakarta text-sm leading-relaxed text-gray-700">{row.value}</p>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed text-gray-500">{row.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

export function DifferentiationSection() {
  const general = ["temporary conversation", "generates possible answers", "does not structure experiments over time", "generated text may not be connected to proof"];
  const startupx = ["persistent founder workspace", "connects claims to evidence", "records experiments and outcomes", "shows contradictions and missing evidence", "preserves decision history"];
  const comparisons = [
    { title: "General AI assistant", items: general },
    { title: "StartupX AI", items: startupx },
  ];

  return (
    <section className="editorial-section bg-[#fffefa] px-5 py-20">
      <div className="container-custom">
        <AnimatedSection className="mb-12 max-w-3xl">
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Not another one-time AI answer
          </h2>
          <p className="font-jakarta text-lg leading-relaxed text-gray-600">
            StartupX AI is built for recurring founder work: collecting proof, seeing contradictions and deciding the next experiment.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {comparisons.map(({ title, items }) => (
            <AnimatedSection key={title}>
              <div className="surface-panel h-full p-6">
                <h3 className="mb-5 font-bricolage text-lg font-bold text-gray-900">{title}</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 size={15} className="mt-1 flex-shrink-0 text-emerald-600" />
                      <p className="font-jakarta text-sm leading-relaxed text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RecurringEvidenceSection() {
  const useCases = ["record customer interviews", "review contradictions", "update assumptions", "track experiments", "compare evidence over time", "preserve decision history", "prepare reports and investor updates"];
  const flow = ["Customer interview", "new evidence", "updated assumption", "experiment", "result", "decision"];

  return (
    <section className="editorial-section bg-[var(--color-bg-primary)] px-5 py-20">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-12">
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Your startup changes every week. Your evidence should too.
          </h2>
          <p className="mx-auto max-w-2xl font-jakarta text-lg leading-relaxed text-gray-600">
            Use the workspace repeatedly as new interviews, experiments and decisions change what you believe.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="surface-panel p-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {flow.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-lg border border-black/8 bg-[#f8f6f0] px-3 py-2 font-jakarta text-sm font-semibold text-gray-700">
                    {step}
                  </span>
                  {index < flow.length - 1 && <ArrowRight size={14} className="text-gray-300" />}
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        <StaggerContainer className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.04}>
          {useCases.map((item) => (
            <StaggerItem key={item}>
              <div className="surface-inset p-4 font-jakarta text-sm font-medium text-gray-600">{item}</div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

export function CapabilitiesSection() {
  const available = ["manual evidence collection", "interview and research notes", "supporting and contradicting evidence", "assumption tracking", "experiment tracking", "decision history", "evidence-backed assessments", "reports and exports"];
  const planned = ["optional public-source integrations", "automated market-signal monitoring", "additional research providers", "improved team collaboration"];
  const capabilityGroups = [
    { title: "Available now", items: available, badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { title: "Being developed", items: planned, badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  ];

  return (
    <section className="editorial-section bg-[#fffefa] px-5 py-20">
      <div className="container-custom">
        <AnimatedSection className="mb-12 max-w-3xl">
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            What StartupX AI does today
          </h2>
          <p className="font-jakarta text-lg leading-relaxed text-gray-600">
            Current capabilities are separated from what is being developed, so the product does not imply automatic research coverage that is not live yet.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {capabilityGroups.map(({ title, items, badgeClass }) => (
            <AnimatedSection key={title}>
              <div className="surface-panel h-full p-6">
                <span className={`mb-5 inline-flex rounded-md border px-2.5 py-1 font-jakarta text-xs font-semibold ${badgeClass}`}>
                  {title}
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 size={15} className="mt-1 flex-shrink-0 text-emerald-600" />
                      <p className="font-jakarta text-sm leading-relaxed text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
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
    description: "Assess your idea's assumptions. Detect risks, missing evidence, and opportunities before investing weeks in the wrong workflow.",
    href: "/idea-engine",
    color: "#10b981",
    bg: "rgba(16,185,129,0.06)",
    border: "rgba(16,185,129,0.16)",
    outputs: ["Evidence Score", "Risk Factors", "ICP Suggestions", "Differentiation"],
  },
  {
    icon: Swords,
    title: "Competitor Intelligence",
    description: "Map competitors, review their positioning, and identify whitespace to investigate with better evidence.",
    href: "/competitor-intelligence",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.16)",
    outputs: ["Direct Competitors", "Positioning Gaps", "Beat Strategy", "White Space Map"],
  },
  {
    icon: DollarSign,
    title: "Revenue Engine",
    description: "Pressure-test monetization strategy with pricing tiers, conversion blockers, and recommended pricing experiments.",
    href: "/revenue-engine",
    color: "#059669",
    bg: "rgba(5,150,105,0.06)",
    border: "rgba(5,150,105,0.16)",
    outputs: ["Pricing Tiers", "Revenue Leaks", "Conversion Blockers", "Upsell Strategy"],
  },
  {
    icon: Brain,
    title: "User Psychology Engine",
    description: "Review trust, UX, and copy. Identify likely friction points, weak proof, and what to fix first.",
    href: "/user-psychology",
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.06)",
    border: "rgba(244,63,94,0.16)",
    outputs: ["Trust Score", "Brutal Roast", "Friction Points", "UX Fixes"],
  },
  {
    icon: TrendingUp,
    title: "Growth Engine",
    description: "Plan first-customer experiments with channel recommendations, outreach direction, and a step-by-step launch playbook.",
    href: "/growth-engine",
    color: "#2563eb",
    bg: "rgba(37,99,235,0.06)",
    border: "rgba(37,99,235,0.16)",
    outputs: ["10-Customer Plan", "Channel Stack", "Content Hooks", "Launch Steps"],
  },
  {
    icon: Target,
    title: "Founder Decision Engine",
    description: "Prioritize founder decisions with top risks, what not to build, traction paths to test, and a confidence score.",
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
    title: "ColdDM",
    description: "Draft outreach messages for WhatsApp, LinkedIn, and email. Short, medium, long variants with follow-ups included.",
    href: "/cold-dm",
    color: "#10b981",
    badge: "HOT",
  },
  {
    icon: Palette,
    title: "BrandForge",
    description: "Draft startup names, taglines, positioning lines, brand personality, and a color direction.",
    href: "/brand-forge",
    color: "#7c3aed",
    badge: "NEW",
  },
];

export function EnginesSection() {
  return (
    <section id="engines" className="editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 mb-5">
            <SearchCheck size={12} className="text-emerald-500" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700">
              Evidence Workflow
            </span>
          </div>
          <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-5">
            A complete founder assessment system.{" "}
            <span className="text-gradient-brand">From assumptions to evidence.</span>
          </h2>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Each workflow turns messy founder questions into structured findings, evidence gaps, and practical next validation actions.
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
                      className="group flex h-full cursor-pointer flex-col gap-4 rounded-xl border bg-[#fffefa] p-6 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md"
                      style={{ borderColor: engine.border }}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
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
                            className="rounded-md border px-2 py-0.5 font-jakarta text-[10px] font-semibold"
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
                        className="flex items-center gap-1.5 font-jakarta text-sm font-semibold transition-all group-hover:gap-2.5"
                        style={{ color: engine.color }}
                      >
                        Review findings
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
          <p className="mb-8 text-center font-jakarta text-xs font-semibold text-gray-500">
            Revenue Tools
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {revenueTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={tool.href}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="group cursor-pointer rounded-xl border border-black/8 bg-[#fffefa] p-6 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-emerald-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${tool.color}10`, border: `1px solid ${tool.color}25` }}
                      >
                        <Icon size={18} style={{ color: tool.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-bricolage text-base font-bold text-gray-900">
                            {tool.title}
                          </h3>
                          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-700">
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
  { icon: SearchCheck, title: "Evidence collection", description: "Separate sources, founder notes, assumptions, and generated assessments before making decisions.", color: "#059669" },
  { icon: Shield, title: "Security-hardened by design", description: "Rate limiting, input validation, secure API handling. Built like a real product.", color: "#10b981" },
  { icon: Globe, title: "Regional context", description: "Assess market and customer context without treating broad market claims as proof.", color: "#2563eb" },
  { icon: BarChart3, title: "Score transparency", description: "Review components, confidence, missing evidence, and what would improve each Evidence Score.", color: "#1f3a5f" },
  { icon: Users, title: "Founder workspace", description: "Keep assumptions, notes, reports, and next actions in one calm operating view.", color: "#be6a2f" },
  { icon: CheckCircle2, title: "Decision history", description: "Record what changed and keep a trail of why the next experiment matters.", color: "#059669" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="editorial-section bg-[#fffefa] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3.5 py-1.5">
            <span className="font-jakarta text-xs font-semibold text-violet-700">
              Product depth
            </span>
          </div>
          <h2 className="mb-5 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            A workspace for the messy middle between idea and evidence
          </h2>
          <p className="mx-auto max-w-xl font-jakarta text-lg text-gray-600">
            The interface is built for reviewing evidence, naming uncertainty, and deciding what to test next.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <StaggerItem key={f.title}>
                <div className="surface-inset h-full p-6 transition-all duration-200 hover:-translate-y-px hover:border-black/12 hover:bg-white hover:shadow-sm">
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
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
// HOW IT WORKS SECTION
// ============================================
const workflow = [
  {
    icon: FileText,
    title: "Share the startup context",
    description: "Add your idea, audience, market, current page, or offer. Each workflow asks only for the context it needs.",
  },
  {
    icon: SearchCheck,
    title: "Run focused assessment tools",
    description: "Choose the workflow for the decision in front of you: evidence, market, competitors, revenue, psychology, growth, outreach, or brand.",
  },
  {
    icon: CheckCircle2,
    title: "Review findings and gaps",
    description: "Get structured scores, risks, action steps, and messaging with clear limits instead of another blank chat.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="workflow" className="editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-1.5">
            <Zap size={12} className="text-emerald-600" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700">
              Workflow
            </span>
          </div>
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            From uncertainty to structured next steps
          </h2>
          <p className="mx-auto max-w-2xl font-jakarta text-lg leading-relaxed text-gray-600">
            StartupX AI is designed around founder decisions, evidence review, and repeatable workflows.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5" staggerDelay={0.1}>
          {workflow.map((step, i) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.title}>
                <div className="surface-panel h-full p-7">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                      <Icon size={18} className="text-emerald-600" />
                    </div>
                    <span className="font-mono text-xs font-bold text-gray-300">0{i + 1}</span>
                  </div>
                  <h3 className="font-bricolage text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="font-jakarta text-sm text-gray-500 leading-relaxed">{step.description}</p>
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
// COMPARISON SECTION
// ============================================
const comparisonRows = [
  ["Startup-specific workflows", true, false, false],
  ["Scores, risks, and action plans", true, true, false],
  ["Market, revenue, growth, brand, and outreach in one place", true, false, false],
  ["Useful for rapid iteration", true, false, true],
  ["Affordable for early founders", true, false, true],
  ["Clear limits and missing evidence", true, false, false],
];

export function ComparisonSection() {
  const columns = ["StartupX AI", "Consultants", "Blank chat"];

  return (
    <section className="editorial-section bg-[#fffefa] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-1.5">
            <Scale size={12} className="text-blue-600" />
            <span className="font-jakarta text-xs font-semibold text-blue-700">
              Comparison
            </span>
          </div>
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Built for the gap between prompts and consultants
          </h2>
          <p className="mx-auto max-w-2xl font-jakarta text-lg leading-relaxed text-gray-600">
            Get structured startup thinking with clearer limits, evidence gaps, and next actions.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <div className="overflow-x-auto rounded-xl border border-black/8 bg-white shadow-sm">
            <div className="min-w-[640px]">
            <div className="grid grid-cols-[1.5fr_repeat(3,1fr)] border-b border-black/8 bg-[#f8f6f0]">
              <div className="p-4 font-jakarta text-xs font-semibold text-gray-500">Capability</div>
              {columns.map((column) => (
                <div key={column} className="p-4 text-center font-jakarta text-xs font-semibold text-gray-700">
                  {column}
                </div>
              ))}
            </div>
            {comparisonRows.map(([label, startupx, consultants, chat]) => (
              <div key={String(label)} className="grid grid-cols-[1.5fr_repeat(3,1fr)] border-b border-black/5 last:border-b-0">
                <div className="p-4 font-jakarta text-sm text-gray-600">{label}</div>
                {[startupx, consultants, chat].map((value, i) => (
                  <div key={i} className="p-4 flex items-center justify-center">
                    {value ? (
                      <CheckCircle2 size={17} className="text-emerald-500" />
                    ) : (
                      <span className="w-4 h-px bg-gray-200" />
                    )}
                  </div>
                ))}
              </div>
            ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================
// TRUST SECTION
// ============================================
const trustItems = [
  {
    icon: Lock,
    title: "Private founder workspace",
    description: "Your startup inputs are used for your own workspace and reports, not displayed publicly on the product.",
  },
  {
    icon: Shield,
    title: "Authenticated dashboard",
    description: "Usage and subscription status are tied to your account through Supabase authentication.",
  },
  {
    icon: Globe,
    title: "International pricing",
    description: "Founder is billed in USD with clear monthly and annual options.",
  },
  {
    icon: BarChart3,
    title: "Transparent usage",
    description: "Your dashboard shows monthly usage, remaining quota, and subscription state.",
  },
];

export function TrustSection() {
  return (
    <section className="editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-1.5">
              <Shield size={12} className="text-emerald-600" />
              <span className="font-jakarta text-xs font-semibold text-emerald-700">
                Trust layer
              </span>
            </div>
          <h2 className="mb-5 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
              Serious enough for real founder work
            </h2>
            <p className="font-jakarta text-lg leading-relaxed text-gray-600">
              Strategy tools should feel clear, private, and accountable. StartupX AI keeps the product focused on what founders need to decide, test, and improve.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="surface-panel p-6">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-[#f8f6f0]">
                    <Icon size={16} className="text-emerald-600" />
                  </div>
                  <h3 className="font-bricolage text-sm font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="font-jakarta text-sm text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================
// METHODOLOGY SECTION
// ============================================
const methodologyItems = [
  {
    title: "Evidence is labeled by source type",
    detail: "Verified public evidence, founder-provided evidence, customer research, experiment results, assumptions, and generated assessments are shown separately.",
  },
  {
    title: "Scores expose their inputs",
    detail: "Evidence Scores show components, confidence, missing evidence, evidence quality, and what would improve the score.",
  },
  {
    title: "Weak evidence lowers confidence",
    detail: "The product shows insufficient evidence states instead of turning missing data into precise conclusions.",
  },
  {
    title: "Findings remain decision support",
    detail: "StartupX AI does not prove demand or guarantee outcomes. It helps founders decide what evidence to collect next.",
  },
];

const faqItems = [
  {
    q: "Does StartupX AI prove my startup will work?",
    a: "No. It organizes the evidence currently available and shows what is still unproven so you can decide what to test next.",
  },
  {
    q: "Can I add my own evidence?",
    a: "Yes. The Evidence Engine is structured around sources, interview notes, assumptions, and experiment results.",
  },
  {
    q: "What happens when evidence is weak?",
    a: "The score shows lower confidence, missing evidence, and recommended validation actions instead of a falsely precise conclusion.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-1.5">
            <span className="font-jakarta text-xs font-semibold text-amber-700">
              Methodology
            </span>
          </div>
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Honest about what is known and unknown
          </h2>
          <p className="mx-auto max-w-2xl font-jakarta text-lg leading-relaxed text-gray-600">
            The system is designed to make uncertainty visible, not hide it behind confident language.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 gap-5 md:grid-cols-2" staggerDelay={0.08}>
          {methodologyItems.map((item) => (
            <StaggerItem key={item.title}>
              <div className="surface-panel h-full p-6">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                </div>
                <p className="font-bricolage text-sm font-bold text-gray-900">{item.title}</p>
                <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-500">{item.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.12} className="mt-10">
          <div className="surface-panel p-6">
            <p className="mb-4 font-bricolage text-sm font-bold text-gray-900">FAQ</p>
            <div className="divide-y divide-black/6">
              {faqItems.map((item) => (
                <details key={item.q} className="group py-4 first:pt-0 last:pb-0">
                  <summary className="cursor-pointer list-none font-bricolage text-sm font-bold text-gray-800">
                    {item.q}
                  </summary>
                  <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-500">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </AnimatedSection>
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
    features: [`${PLANS.free.analysesPerMonth} analyses/month`, "Idea & Market Engine", "Competitor Intelligence", "2 ColdDM generations", "2 BrandForge generations"],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Founder",
    price: `$${PLANS.founder.monthlyPrice}`,
    period: "/month",
    description: "For solo founders running continuous customer discovery.",
    features: [`${PLANS.founder.analysesPerMonth} analyses/month`, "All assessment tools", "25 ColdDM generations", "25 BrandForge generations", "Investor memo + slide summary", "PDF exports", "Saved history"],
    cta: "Upgrade to Founder",
    href: "/payment?plan=founder&billing=monthly",
    highlighted: true,
    badge: "Starter upgrade",
  },
  {
    name: "Growth",
    price: `$${PLANS.growth.monthlyPrice}`,
    period: "/month",
    description: "For founders testing assumptions and experiments every week.",
    features: [`${PLANS.growth.analysesPerMonth} analyses/month`, "All assessment tools", "100 ColdDM generations", "100 BrandForge generations", "Investor memo + slide summary", "Shareable reports", "3 workspaces"],
    cta: "Upgrade to Growth",
    href: "/payment?plan=growth&billing=monthly",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Scale",
    price: `$${PLANS.scale.monthlyPrice}`,
    period: "/month",
    description: "For teams managing multiple products, evidence sources and decisions.",
    features: [`${PLANS.scale.analysesPerMonth} analyses/month`, "All assessment tools", "300 ColdDM generations", "300 BrandForge generations", "Investor memo + slide summary", "Team-ready workspaces", "Priority processing"],
    cta: "Upgrade to Scale",
    href: "/payment?plan=scale&billing=monthly",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="editorial-section bg-[#fffefa] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection className="text-center mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3.5 py-1.5">
            <span className="font-jakarta text-xs font-semibold text-blue-700">
              Simple Pricing
            </span>
          </div>
          <h2 className="mb-4 font-bricolage text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            Invest in your startup,{" "}
            <span className="text-gradient-brand">not consultants</span>
          </h2>
          <p className="mx-auto max-w-lg font-jakarta text-lg text-gray-600">
            Start free with the core workflows. Upgrade when you need higher usage, exports, sharing, and the full assessment stack.
          </p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 max-w-7xl mx-auto" staggerDelay={0.1}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <div
                className={`relative flex h-full flex-col rounded-xl border p-7 transition-all duration-200 ${
                  plan.highlighted
                    ? "border-emerald-300 bg-gradient-to-b from-emerald-50 to-white shadow-md shadow-emerald-100"
                    : "border-black/8 bg-[#f8f6f0] hover:bg-white hover:shadow-sm"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-md bg-emerald-700 px-3 py-1 font-mono text-[10px] font-semibold text-white shadow-sm shadow-emerald-900/20">
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
            All plans are billed in USD · Upgrade, downgrade, or cancel anytime · No hidden fees
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
    <section className="editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <AnimatedSection>
          <div className="relative overflow-hidden rounded-2xl">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800" />
            <div className="absolute inset-0 dot-pattern opacity-20" />

            <div className="relative p-12 sm:p-16 text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/15 px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="font-jakarta text-xs font-semibold text-white">
                  Ready to review the evidence?
                </span>
              </div>
              <h2 className="font-bricolage text-4xl sm:text-5xl font-bold text-white tracking-tight mb-5">
                Start with the assumptions that matter most
              </h2>
              <p className="font-jakarta text-lg text-emerald-100 max-w-lg mx-auto mb-10 leading-relaxed">
                Use StartupX AI to review evidence, record what is still unproven, and decide what to test next.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup?next=/evidence-engine">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex h-14 items-center gap-2 rounded-xl bg-white px-8 font-jakarta text-base font-semibold text-emerald-800 shadow-lg shadow-black/8 transition-shadow hover:shadow-xl hover:shadow-black/8 focus-ring"
                  >
                    Start an assessment <ArrowRight size={18} />
                  </motion.button>
                </Link>
                <Link href="/pricing">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-14 rounded-xl border border-white/40 px-8 font-jakarta text-base font-semibold text-white transition-colors hover:bg-white/10 focus-ring"
                  >
                    See all plans
                  </motion.button>
                </Link>
              </div>
              <p className="mt-6 font-jakarta text-sm text-emerald-200">
                Free to start · No credit card required · Evidence-first workflow
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}




