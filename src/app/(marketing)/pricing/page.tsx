import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, X, Zap } from "lucide-react";
import Button from "@/components/ui/Button";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sage-800/50 bg-sage-950/40 mb-6">
            <Zap size={11} className="text-emerald-600" />
            <span className="font-bricolage text-xs font-semibold text-emerald-600">
              Simple, honest pricing
            </span>
          </div>
          <h1 className="font-bricolage text-5xl sm:text-6xl font-bold text-gray-800 tracking-tight mb-5">
            Invest in your startup,{" "}
            <span className="text-gradient-sage">not consultants</span>
          </h1>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Start with the core engines, then upgrade when you need the full
            assessment stack, exports, and higher monthly usage.
          </p>
        </AnimatedSection>

        {/* Plans */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-20 max-w-7xl mx-auto" staggerDelay={0.1}>
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <div
                className={`relative h-full flex flex-col rounded-2xl border p-7 ${
                  plan.highlighted
                    ? "border-sage-700/50 bg-gradient-to-b from-sage-950/30 to-transparent shadow-2xl shadow-sage-900/20"
                    : "border-black/8 bg-gray-50"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="font-bricolage text-[10px] font-bold px-3 py-1.5 rounded-full bg-gradient-to-r from-sage-700 to-forest-700 text-white shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan info */}
                <div className="mb-8">
                  <p
                    className="font-bricolage text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: plan.color }}
                  >
                    {plan.name}
                  </p>
                  <p className="font-jakarta text-sm text-gray-500 mb-5">
                    {plan.tagline}
                  </p>
                  <div className="flex items-end gap-1.5">
                    <span className="font-bricolage text-4xl font-bold text-gray-800">
                      {plan.price}
                    </span>
                    <span className="font-jakarta text-sm text-gray-500 mb-1">
                      {plan.priceNote}
                    </span>
                  </div>
                  {"annualNote" in plan && plan.annualNote && (
                    <p className="font-jakarta text-xs text-emerald-600 mt-1">
                      {plan.annualNote}
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="flex-1 space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <div key={f.text} className="flex items-start gap-2.5">
                      {f.included ? (
                        <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X size={15} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span
                        className={`font-jakarta text-sm leading-tight ${
                          f.included ? "text-gray-500" : "text-gray-500"
                        }`}
                      >
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link href={plan.href}>
                  <Button
                    fullWidth
                    variant={plan.highlighted ? "primary" : "outline"}
                    size="md"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimatedSection delay={0.15} className="text-center -mt-10 mb-20">
          <p className="font-jakarta text-sm text-gray-400">
            All prices are in USD. Upgrade, downgrade, or cancel anytime.
          </p>
        </AnimatedSection>

        {/* FAQ */}
        <AnimatedSection className="max-w-3xl mx-auto">
          <h2 className="font-bricolage text-3xl font-bold text-gray-800 text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-black/6 bg-gray-50 p-6"
              >
                <h3 className="font-bricolage text-sm font-bold text-gray-800 mb-2.5">
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


