import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { BorderGlow } from "@/components/ui/BorderGlow";
import AnimatedSection, { StaggerItem } from "@/components/shared/AnimatedSection";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing - StartupX AI",
  description:
    "Simple, transparent pricing for founders. Start free, upgrade when you need the full assessment stack.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    url: "/pricing",
  },
};

const plans = [
  {
    name: "Starter",
    tagline: "Explore the platform",
    price: "Free",
    priceNote: "forever",
    color: "#72845e",
    features: [
      { text: `${PLANS.free.analysesPerMonth} analyses/month`, included: true },
      { text: "Idea & Market Engine", included: true },
      { text: "Competitor Intelligence", included: true },
      { text: "2 ColdDM generations/month", included: true },
      { text: "2 BrandForge generations/month", included: true },
      { text: "One startup workspace", included: true },
      { text: "Explore the core engines before upgrading", included: true },
      { text: "Premium intelligence engines", included: false },
      { text: "PDF exports", included: false },
      { text: "Investor memo + slide-ready summary", included: false },
      { text: "Shareable reports", included: false },
    ],
    cta: "Start Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Founder",
    tagline: "For solo founders running continuous customer discovery.",
    price: `$${PLANS.founder.monthlyPrice}`,
    priceNote: "per month",
    annualNote: `$${PLANS.founder.yearlyPrice} billed annually`,
    color: "#72845e",
    badge: "Starter upgrade",
    features: [
      { text: `${PLANS.founder.analysesPerMonth} analyses/month`, included: true },
      { text: "All assessment tools", included: true },
      { text: "25 ColdDM generations/month", included: true },
      { text: "25 BrandForge generations/month", included: true },
      { text: "PDF exports", included: true },
      { text: "Investor memo + slide-ready summary", included: true },
      { text: "Saved analysis history", included: true },
      { text: "One startup workspace", included: true },
      { text: "Email support", included: true },
      { text: "Shareable reports", included: false },
    ],
    cta: "Upgrade to Founder",
    href: "/payment?plan=founder&billing=monthly",
    highlighted: true,
  },
  {
    name: "Growth",
    tagline: "For founders testing assumptions and experiments every week.",
    price: `$${PLANS.growth.monthlyPrice}`,
    priceNote: "per month",
    annualNote: `$${PLANS.growth.yearlyPrice} billed annually`,
    color: "#4a63b5",
    badge: "Most Popular",
    features: [
      { text: `${PLANS.growth.analysesPerMonth} analyses/month`, included: true },
      { text: "All assessment tools", included: true },
      { text: "100 ColdDM generations/month", included: true },
      { text: "100 BrandForge generations/month", included: true },
      { text: "PDF exports", included: true },
      { text: "Investor memo + slide-ready summary", included: true },
      { text: "Shareable reports", included: true },
      { text: "Saved analysis history", included: true },
      { text: "Up to 3 startup workspaces", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Upgrade to Growth",
    href: "/payment?plan=growth&billing=monthly",
    highlighted: false,
  },
  {
    name: "Scale",
    tagline: "For teams managing multiple products, evidence sources and decisions.",
    price: `$${PLANS.scale.monthlyPrice}`,
    priceNote: "per month",
    annualNote: `$${PLANS.scale.yearlyPrice} billed annually`,
    color: "#9e724e",
    features: [
      { text: `${PLANS.scale.analysesPerMonth} analyses/month`, included: true },
      { text: "All assessment tools", included: true },
      { text: "300 ColdDM generations/month", included: true },
      { text: "300 BrandForge generations/month", included: true },
      { text: "PDF exports", included: true },
      { text: "Investor memo + slide-ready summary", included: true },
      { text: "Shareable reports", included: true },
      { text: "Saved analysis history", included: true },
      { text: "Up to 10 startup workspaces", included: true },
      { text: "Team-ready workspaces", included: true },
      { text: "Priority processing", included: true },
    ],
    cta: "Upgrade to Scale",
    href: "/payment?plan=scale&billing=monthly",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Starter plan is completely free with no credit card required. You only need payment details when upgrading to a paid plan.",
  },
  {
    q: "Is there a free trial?",
    a: "The Starter plan is available without a card. Upgrade whenever you need 50, 150, or 400 analyses per month.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel at any time. Upgrades take effect immediately. Downgrades take effect at the end of your billing cycle.",
  },
  {
    q: "How are assessments generated?",
    a: "StartupX AI combines founder inputs, available evidence, score components, and structured reasoning. Generated findings are decision support, not verified market proof.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Paid plans include a simple 7-day refund window. If StartupX AI is not useful for your workflow, contact support and we will help.",
  },
  {
    q: "Can I use StartupX AI for client work or agencies?",
    a: "Founder is best for solo assessment, Growth is for weekly iteration, and Scale is for teams or heavier usage.",
  },
];

export default function PricingPage() {
  return (
    <div className="pt-24 pb-20 px-5">
      <div className="container-custom">
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-sage-800/50 bg-sage-950/40 mb-6">
            <span className="font-jakarta text-xs font-semibold text-emerald-600">
              Simple, honest pricing
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-gray-800 tracking-tight mb-5">
            Invest in your startup,{" "}
            <span className="text-gradient-sage">not consultants</span>
          </h1>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Start with the core engines, then upgrade when you need the full
            assessment stack, exports, and higher monthly usage.
          </p>
        </AnimatedSection>

        {/* Plans */}
        <div className="mb-20 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <StaggerItem key={plan.name}>
              <BorderGlow
                recommended={plan.name === "Growth"}
                glowColor={plan.name === "Growth" ? "16, 185, 129" : "148, 163, 184"}
                intensity={plan.name === "Growth" ? 0.58 : 0.28}
                className="h-full"
              >
                <article
                  className={`flex h-full min-h-[590px] flex-col rounded-[18px] border p-6 shadow-[0_22px_70px_rgba(15,23,42,0.14)] backdrop-blur md:p-7 ${
                    plan.name === "Growth"
                      ? "border-emerald-300/55 bg-[#071511]/92 text-white"
                      : "border-white/16 bg-[#101418]/88 text-white"
                  }`}
                >
                  <div className="mb-5 flex min-h-7 items-center justify-between gap-3">
                    <span className="font-mono text-[11px] font-semibold text-white/45">{String(index + 1).padStart(2, "0")}</span>
                    {plan.badge ? (
                      <span
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold ${
                          plan.name === "Growth"
                            ? "border-emerald-300/40 bg-emerald-300/12 text-emerald-100"
                            : "border-white/15 bg-white/8 text-white/70"
                        }`}
                      >
                        {plan.badge}
                      </span>
                    ) : (
                      <span className="h-px w-10 bg-white/14" />
                    )}
                  </div>

                  <div className="mb-7">
                  <p
                    className={`mb-2 font-jakarta text-sm font-bold ${plan.name === "Growth" ? "text-emerald-100" : "text-white/82"}`}
                  >
                    {plan.name}
                  </p>
                  <p className="min-h-[44px] font-jakarta text-sm leading-relaxed text-white/58">
                    {plan.tagline}
                  </p>
                  <div className="mt-6 flex items-end gap-1.5">
                    <span className="font-jakarta text-4xl font-bold tracking-tight text-white">
                      {plan.price}
                    </span>
                    <span className="mb-1 font-jakarta text-sm text-white/48">
                      {plan.priceNote}
                    </span>
                  </div>
                  {"annualNote" in plan && plan.annualNote && (
                    <p className="mt-1 min-h-4 font-jakarta text-xs text-emerald-200/85">
                      {plan.annualNote}
                    </p>
                  )}
                </div>

                <div className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <div key={f.text} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 font-mono text-xs leading-none ${f.included ? "text-emerald-300" : "text-white/28"}`}
                      >
                        {f.included ? "-" : "x"}
                      </span>
                      <span
                        className={`font-jakarta text-sm leading-snug ${
                          f.included ? "text-white/68" : "text-white/32"
                        }`}
                      >
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                <Link href={plan.href} className="mt-auto block">
                  <Button
                    fullWidth
                    variant={plan.name === "Growth" ? "primary" : "outline"}
                    size="md"
                    className={plan.name === "Growth" ? "" : "border-white/16 bg-white/6 text-white hover:bg-white/10 hover:text-white"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                </article>
              </BorderGlow>
            </StaggerItem>
          ))}
        </div>

        <AnimatedSection delay={0.15} className="text-center -mt-10 mb-20">
          <p className="font-jakarta text-sm text-gray-400">
            All prices are in USD. Upgrade, downgrade, or cancel anytime.
          </p>
        </AnimatedSection>

        {/* FAQ */}
        <AnimatedSection className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-gray-800 text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-black/6 bg-gray-50 p-6"
              >
                <h3 className="font-jakarta text-sm font-bold text-gray-800 mb-2.5">
                  {faq.q}
                </h3>
                <p className="font-jakarta text-sm text-gray-500 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Bottom CTA */}
        <AnimatedSection delay={0.1} className="text-center mt-20">
          <p className="font-jakarta text-gray-500 mb-4">
            Still have questions?
          </p>
          <Link href="/support">
            <Button variant="secondary" size="md">
              Contact our team
            </Button>
          </Link>
        </AnimatedSection>
      </div>
    </div>
  );
}


