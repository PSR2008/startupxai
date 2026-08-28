import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/plans";
import styles from "./PricingPage.module.css";

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
    badge: "Start free",
    description: "For founders trying the core assessment workflow.",
    monthly: "Free",
    yearly: "",
    analyses: `${PLANS.free.analysesPerMonth} analyses/month`,
    href: "/signup",
    cta: "Start free",
    features: ["Idea and market checks", "Competitor snapshot", "One startup workspace"],
  },
  {
    name: "Founder",
    badge: "Solo founder",
    description: "For validating one startup idea with steady weekly analysis.",
    monthly: "$5/month",
    yearly: "$49/year",
    analyses: `${PLANS.founder.analysesPerMonth} analyses/month`,
    href: "/payment?plan=founder",
    cta: "Choose Founder",
    features: ["All assessment tools", "PDF exports", "Saved analysis history"],
  },
  {
    name: "Growth",
    badge: "Most popular",
    description: "For teams testing assumptions, pricing, channels, and customer signals.",
    monthly: "$10/month",
    yearly: "$99/year",
    analyses: `${PLANS.growth.analysesPerMonth} analyses/month`,
    href: "/payment?plan=growth",
    cta: "Choose Growth",
    featured: true,
    features: ["Shareable reports", "Priority support", "Up to 3 startup workspaces"],
  },
  {
    name: "Scale",
    badge: "Team-ready",
    description: "For heavier validation workflows across multiple startup projects.",
    monthly: "$15/month",
    yearly: "$149/year",
    analyses: `${PLANS.scale.analysesPerMonth} analyses/month`,
    href: "/payment?plan=scale",
    cta: "Choose Scale",
    features: ["Priority processing", "Team-ready workspaces", "Up to 10 startup workspaces"],
  },
];

const comparisonRows = [
  ["Monthly usage", "5", "50", "150", "400"],
  ["Reports and exports", "Preview", "Included", "Included", "Included"],
  ["Workspace capacity", "1", "1", "3", "10"],
];

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero} aria-labelledby="pricing-title">
          <div className={styles.heroGlowOne} aria-hidden="true" />
          <div className={styles.heroGlowTwo} aria-hidden="true" />

          <div className={styles.heroContent}>
            <p className={styles.badge}>Simple pricing for evidence-first founders</p>
            <h1 id="pricing-title" className={styles.title}>
              Pick the validation pace that matches your runway.
            </h1>
            <p className={styles.subtitle}>
              Start free, then upgrade when you need more analyses, saved reports,
              exports, and team-ready startup workspaces.
            </p>
          </div>
        </section>

        <section className={styles.pricingGrid} aria-label="StartupX AI plans">
          {plans.map((plan) => (
            <article
              className={`${styles.planCard} ${plan.featured ? styles.featuredPlan : ""}`}
              key={plan.name}
            >
              <div className={styles.planHeader}>
                <span className={styles.planBadge}>{plan.badge}</span>
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
              </div>

              <div className={styles.priceBlock}>
                <strong>{plan.monthly}</strong>
                {plan.yearly ? <span>{plan.yearly}</span> : <span>No credit card required</span>}
              </div>

              <p className={styles.usage}>{plan.analyses}</p>

              <ul className={styles.featureList}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <Link
                className={`${styles.planCta} ${plan.featured ? styles.featuredCta : ""}`}
                href={plan.href}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className={styles.comparison} aria-labelledby="comparison-title">
          <div className={styles.sectionHeader}>
            <p>Plan comparison</p>
            <h2 id="comparison-title">Clear limits, no hidden checkout surprises.</h2>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Starter</th>
                  <th>Founder</th>
                  <th>Growth</th>
                  <th>Scale</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, starter, founder, growth, scale]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{starter}</td>
                    <td>{founder}</td>
                    <td>{growth}</td>
                    <td>{scale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.noteCard} aria-label="Checkout note">
          <div>
            <p>Checkout uses INR equivalents.</p>
            <span>
              Founder Rs.399/mo or Rs.3999/year. Growth Rs.799/mo or Rs.7999/year.
              Scale Rs.1199/mo or Rs.11999/year.
            </span>
          </div>
          <Link href="/signup">Start with Starter</Link>
        </section>
      </div>
    </main>
  );
}
