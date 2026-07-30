"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Flag,
  FlaskConical,
  Lightbulb,
  MessageSquare,
  Palette,
  SearchCheck,
  ShieldQuestion,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import ScrollStack, { ScrollStackItem } from "./ScrollStack";

type StackCard = {
  number: string;
  category: "Core workflow" | "Assessment tool" | "Revenue tool";
  title: string;
  positioning: string;
  description: string;
  capabilities: [string, string, string];
  trustNote: string;
  href: string;
  cta: string;
  icon: typeof SearchCheck;
  accent: "emerald" | "teal" | "blue" | "indigo" | "violet" | "amber";
  markerId?: string;
};

const accentStyles: Record<StackCard["accent"], { badge: string; icon: string; line: string }> = {
  emerald: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
    line: "bg-emerald-500",
  },
  teal: {
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    icon: "border-teal-200 bg-teal-50 text-teal-700",
    line: "bg-teal-500",
  },
  blue: {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    line: "bg-blue-500",
  },
  indigo: {
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    icon: "border-indigo-200 bg-indigo-50 text-indigo-700",
    line: "bg-indigo-500",
  },
  violet: {
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    icon: "border-violet-200 bg-violet-50 text-violet-700",
    line: "bg-violet-500",
  },
  amber: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    line: "bg-amber-500",
  },
};

const stackCards: StackCard[] = [
  {
    number: "01",
    category: "Core workflow",
    title: "Evidence Engine",
    positioning: "Turn founder assumptions into evidence requirements.",
    description: "A persistent workspace for separating context, qualifying evidence, gaps and next validation actions.",
    capabilities: [
      "Record founder context separately from independent evidence",
      "Add interviews, experiment outcomes and attributed public sources",
      "See evidence coverage, gaps and assessable dimensions",
    ],
    trustNote: "Founder claims and generated suggestions are not treated as verified evidence.",
    href: "/evidence-engine",
    cta: "Explore Evidence Engine",
    icon: SearchCheck,
    accent: "emerald",
    markerId: "features",
  },
  {
    number: "02",
    category: "Core workflow",
    title: "Assumptions",
    positioning: "Make the beliefs behind the startup visible.",
    description: "Use the Evidence Engine workspace to name critical claims and track whether evidence supports or challenges them.",
    capabilities: [
      "Define critical customer, market and business assumptions",
      "Connect assumptions to evidence",
      "Identify what remains untested",
    ],
    trustNote: "An assumption remains provisional until relevant evidence supports or contradicts it.",
    href: "/evidence-engine",
    cta: "Review assumptions",
    icon: ShieldQuestion,
    accent: "teal",
  },
  {
    number: "03",
    category: "Core workflow",
    title: "Experiments",
    positioning: "Convert uncertainty into measurable tests.",
    description: "Plan tests, record measured outcomes and connect the learning back to evidence and decisions.",
    capabilities: [
      "Define hypotheses and success thresholds",
      "Record experiment status and outcomes",
      "Connect results to decisions and evidence",
    ],
    trustNote: "A planned experiment does not count as evidence until an outcome is recorded.",
    href: "/evidence-engine",
    cta: "Plan experiments",
    icon: FlaskConical,
    accent: "blue",
  },
  {
    number: "04",
    category: "Core workflow",
    title: "Competitor Intelligence",
    positioning: "Understand alternatives, gaps and positioning risks.",
    description: "Compare the market around your idea and turn competitor observations into questions worth investigating.",
    capabilities: [
      "Review direct and indirect competitors",
      "Compare positioning and market gaps",
      "Generate strategic questions to investigate",
    ],
    trustNote: "Generated analysis is strategic assistance, not verified market truth.",
    href: "/competitor-intelligence",
    cta: "Explore competitors",
    icon: Swords,
    accent: "teal",
  },
  {
    number: "05",
    category: "Core workflow",
    title: "Founder Decisions",
    positioning: "Record what was decidedâ€”and why.",
    description: "Preserve decision context so the team can see how evidence changed the next move.",
    capabilities: [
      "Capture important founder decisions",
      "Preserve supporting context",
      "Maintain a decision history as evidence changes",
    ],
    trustNote: "Recommendations are interpretations; the founder remains responsible for the decision.",
    href: "/founder-decision",
    cta: "Review decisions",
    icon: Flag,
    accent: "emerald",
  },
  {
    number: "06",
    category: "Core workflow",
    title: "Reports",
    positioning: "Share the reasoning behind an assessment.",
    description: "Turn saved work into structured reports that show inputs, confidence and evidence limitations.",
    capabilities: [
      "Generate structured assessment reports",
      "Show evidence coverage and limitations",
      "Export or share findings where supported",
    ],
    trustNote: "Reports distinguish founder context from qualifying evidence.",
    href: "/reports",
    cta: "View reports",
    icon: FileText,
    accent: "blue",
  },
  {
    number: "07",
    category: "Assessment tool",
    title: "Idea & Market Engine",
    positioning: "Structure an idea before committing more time to it.",
    description: "Clarify the customer, problem and early market assumptions before treating the idea as validated.",
    capabilities: [
      "Clarify the customer and problem",
      "Surface major market assumptions",
      "Identify questions that require evidence",
    ],
    trustNote: "The output is an assessment framework, not proof of demand.",
    href: "/idea-engine",
    cta: "Open Idea & Market Engine",
    icon: Lightbulb,
    accent: "indigo",
    markerId: "assessment-tools",
  },
  {
    number: "08",
    category: "Revenue tool",
    title: "Revenue Engine",
    positioning: "Explore how the product could create and capture value.",
    description: "Pressure-test monetisation choices and surface the pricing assumptions that need real payment evidence.",
    capabilities: [
      "Examine potential revenue models",
      "Surface pricing and willingness-to-pay assumptions",
      "Suggest monetisation tests",
    ],
    trustNote: "Revenue potential remains hypothetical until purchase or payment evidence exists.",
    href: "/revenue-engine",
    cta: "Open Revenue Engine",
    icon: DollarSign,
    accent: "amber",
  },
  {
    number: "09",
    category: "Assessment tool",
    title: "User Psychology",
    positioning: "Examine the behaviour behind adoption and retention.",
    description: "Review motivation, objections and friction as hypotheses to validate through customer behaviour.",
    capabilities: [
      "Explore customer motivations",
      "Identify objections and friction",
      "Generate behavioural hypotheses to test",
    ],
    trustNote: "Psychological interpretations should be validated through real customer behaviour.",
    href: "/user-psychology",
    cta: "Open User Psychology",
    icon: Brain,
    accent: "violet",
  },
  {
    number: "10",
    category: "Assessment tool",
    title: "Growth Engine",
    positioning: "Turn growth ideas into measurable acquisition experiments.",
    description: "Translate channel ideas into distribution assumptions, measurable tests and launch priorities.",
    capabilities: [
      "Assess potential distribution channels",
      "Identify channel assumptions",
      "Draft measurable growth tests",
    ],
    trustNote: "Suggested channels are experiments, not guaranteed acquisition paths.",
    href: "/growth-engine",
    cta: "Open Growth Engine",
    icon: TrendingUp,
    accent: "indigo",
  },
  {
    number: "11",
    category: "Assessment tool",
    title: "Founder Decision Engine",
    positioning: "Convert founder context into a focused strategic brief.",
    description: "Summarise context into a practical decision brief with risks, tradeoffs and next experiments.",
    capabilities: [
      "Produce one primary action",
      "Identify high-risk assumptions",
      "Suggest priorities and traction experiments",
    ],
    trustNote: "Strategic interpretations are AI-assisted and based on the context supplied.",
    href: "/founder-decision",
    cta: "Open Founder Decision Engine",
    icon: Target,
    accent: "violet",
  },
  {
    number: "12",
    category: "Assessment tool",
    title: "ColdDM",
    positioning: "Draft clearer founder outreach without generic templates.",
    description: "Create outreach variations for specific audiences and objectives, ready for founder review.",
    capabilities: [
      "Create personalised outreach drafts",
      "Adapt tone and objective",
      "Produce concise message variations",
    ],
    trustNote: "Users must review accuracy and relevance before sending.",
    href: "/cold-dm",
    cta: "Open ColdDM",
    icon: MessageSquare,
    accent: "blue",
  },
  {
    number: "13",
    category: "Assessment tool",
    title: "BrandForge",
    positioning: "Develop an initial brand direction for a new product.",
    description: "Explore positioning, naming and messaging directions before committing to a public brand.",
    capabilities: [
      "Explore positioning language",
      "Generate brand concepts",
      "Draft messaging directions",
    ],
    trustNote: "Generated concepts should be reviewed for originality, trademarks and market fit.",
    href: "/brand-forge",
    cta: "Open BrandForge",
    icon: Palette,
    accent: "indigo",
  },
];

export default function ProductScrollStackSection() {
  return (
    <section className="scroll-stack-section editorial-section bg-[var(--color-bg-primary)] px-5 py-24">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-1.5">
            <ClipboardList size={12} className="text-emerald-600" />
            <span className="font-jakarta text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              The StartupX AI workspace
            </span>
          </div>
          <h2 className="font-display text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl">
            From assumptions to evidence-backed decisions
          </h2>
          <p className="mx-auto mt-5 max-w-2xl font-jakarta text-lg leading-relaxed text-gray-600">
            Explore the connected workflow and specialist tools founders use to assess ideas, collect evidence, run experiments and decide what to do next.
          </p>
        </div>
      </div>

      <ScrollStack
        className="mt-2"
        itemDistance={110}
        itemScale={0.025}
        itemStackDistance={24}
        stackPosition="16%"
        scaleEndPosition="8%"
        baseScale={0.88}
        scaleDuration={0.5}
        rotationAmount={0}
        blurAmount={0}
        useWindowScroll={true}
      >
        {stackCards.map((card) => {
          const Icon = card.icon;
          const accent = accentStyles[card.accent];

          return (
            <ScrollStackItem
              key={card.number}
              id={card.markerId}
              itemClassName="scroll-stack-product-card scroll-mt-28 rounded-[1.6rem] border border-black/8 bg-[#fffefa] p-6 shadow-[0_18px_50px_rgba(15,17,23,0.08)] md:p-10 lg:p-12"
            >
              {card.markerId === "assessment-tools" ? <span id="engines" className="absolute -top-24" aria-hidden="true" /> : null}
              <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
                <div className="flex h-full flex-col">
                  <div className="mb-8 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-gray-400">{card.number}</span>
                    <span className={`rounded-md border px-2.5 py-1 font-jakarta text-xs font-semibold ${accent.badge}`}>
                      {card.category}
                    </span>
                  </div>

                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${accent.icon}`}>
                    <Icon size={20} strokeWidth={2.2} />
                  </div>

                  <h3 className="font-jakarta text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                    {card.title}
                  </h3>
                  <p className="mt-4 font-jakarta text-lg font-semibold leading-snug text-gray-800">
                    {card.positioning}
                  </p>
                  <p className="mt-4 max-w-xl font-jakarta text-sm leading-relaxed text-gray-600 sm:text-base">
                    {card.description}
                  </p>

                  <div className="mt-8">
                    <Link
                      href={card.href}
                      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 font-jakarta text-sm font-semibold text-gray-950 shadow-sm transition-all hover:-translate-y-px hover:border-emerald-200 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      {card.cta}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-[#f8f6f0] p-5 sm:p-6">
                  <div className={`mb-5 h-1.5 w-14 rounded-full ${accent.line}`} />
                  <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Capabilities
                  </p>
                  <ul className="space-y-3">
                    {card.capabilities.map((capability) => (
                      <li key={capability} className="flex gap-3 font-jakarta text-sm leading-relaxed text-gray-700">
                        <CheckCircle2 size={16} className="mt-0.5 flex-none text-emerald-600" />
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 rounded-xl border border-black/8 bg-white p-4">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Trust note
                    </p>
                    <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-600">
                      {card.trustNote}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollStackItem>
          );
        })}
      </ScrollStack>
    </section>
  );
}

export { stackCards as productScrollStackCards };
