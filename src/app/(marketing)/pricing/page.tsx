import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, X, Zap } from "lucide-react";
import Button from "@/components/ui/Button";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";

export const metadata: Metadata = {
  title: "Pricing — StartupX AI",
  description:
    "Simple, transparent pricing for founders. Start free, upgrade when you need the full intelligence stack.",
};

const plans = [
  {
    name: "Starter",
    tagline: "Explore the platform",
    price: "Free",
    priceNote: "forever",
    color: "#72845e",
    features: [
      { text: "3 analyses per day", included: true },
      { text: "Idea & Market Engine", included: true },
      { text: "Growth Engine (basic)", included: true },
      { text: "ColdDM AI (3 messages/day)", included: true },
      { text: "BrandForge AI", included: false },
      { text: "Competitor Intelligence", included: false },
      { text: "Revenue Engine", included: false },
      { text: "User Psychology Engine", included: false },
      { text: "Founder Decision Engine", included: false },
      { text: "PDF exports", included: false },
      { text: "Priority processing", included: false },
    ],
    cta: "Get Started Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Founder",
    tagline: "For founders building seriously",
    price: "₹49",
    priceNote: "per month",
    annualNote: "₹499 billed annually",
    color: "#72845e",
    badge: "Most Popular",
    features: [
      { text: "Unlimited analyses", included: true },
      { text: "Idea & Market Engine", included: true },
      { text: "Growth Engine (full)", included: true },
      { text: "ColdDM AI (unlimited)", included: true },
      { text: "BrandForge AI (unlimited)", included: true },
      { text: "Competitor Intelligence", included: true },
      { text: "Revenue Engine", included: true },
      { text: "User Psychology Engine", included: true },
      { text: "Founder Decision Engine", included: true },
      { text: "PDF exports", included: true },
      { text: "Priority processing", included: true },
    ],
    cta: "Start 7-Day Free Trial",
    href: "/payment?plan=founder",
    highlighted: true,
  },
  {
    name: "Studio",
    tagline: "For teams moving fast",
    price: "$149",
    priceNote: "per month",
    annualNote: "$119/mo billed annually",
    color: "#9e724e",
    features: [
      { text: "Everything in Founder", included: true },
      { text: "3 team seats included", included: true },
      { text: "Saved analysis history", included: true },
      { text: "API access (coming soon)", included: true },
      { text: "Custom brand voice presets", included: true },
      { text: "White-label report exports", included: true },
      { text: "Slack support channel", included: true },
      { text: "Dedicated onboarding call", included: true },
      { text: "Usage analytics dashboard", included: true },
      { text: "Priority processing", included: true },
      { text: "SLA guarantee", included: true },
    ],
    cta: "Start 7-Day Free Trial",
    href: "/payment?plan=studio",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Starter plan is completely free with no credit card required. You only need payment details when upgrading to Founder or Studio.",
  },
  {
    q: "What happens after the 7-day trial?",
    a: "You'll be automatically moved to your chosen paid plan. If you're not satisfied, cancel before day 7 and you won't be charged.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel at any time. Upgrades take effect immediately. Downgrades take effect at the end of your billing cycle.",
  },
  {
    q: "What AI model powers the engines?",
    a: "All six intelligence engines and generation tools are powered by Claude — Anthropic's leading AI model — chosen for its nuanced strategic reasoning and long-context understanding.",
  },
  {
    q: "Is there a money-back guarantee?",
    a: "Yes. All paid plans include a 7-day money-back guarantee. If you're not satisfied with the results, contact us and we'll issue a full refund.",
  },
  {
    q: "Can I use StartupX AI for client work or agencies?",
    a: "The Studio plan covers small agency use. For larger agency or reseller arrangements, contact us at support@startupxai.com for custom pricing.",
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
            One platform. Six intelligence engines. Real-time results. At a fraction
            of what a single advisor would cost.
          </p>
        </AnimatedSection>

        {/* Plans */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 max-w-5xl mx-auto" staggerDelay={0.1}>
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
                      💡 {plan.annualNote}
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
