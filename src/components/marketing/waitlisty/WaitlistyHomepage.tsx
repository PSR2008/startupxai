import Link from "next/link";
import styles from "./WaitlistyHomepage.module.css";

const featurePills = [
  "Market demand",
  "Competitor gaps",
  "Pricing strategy",
  "User psychology",
  "Risk analysis",
  "Growth plan",
];

const workflowSteps = [
  ["01", "Describe the startup idea"],
  ["02", "Review the validation report"],
  ["03", "Choose the next test"],
];

export default function WaitlistyHomepage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.navWrap}>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link className={styles.brand} href="/">
              <span className={styles.brandMark} aria-hidden="true">S</span>
              <span>StartupX <span>AI</span></span>
            </Link>

            <div className={styles.navLinks}>
              <Link href="#features">Features</Link>
              <Link href="#workflow">Workflow</Link>
              <Link href="#pricing">Pricing</Link>
            </div>

            <div className={styles.navActions}>
              <Link className={styles.signIn} href="/signin">Sign in</Link>
              <Link className={styles.navCta} href="/signup">Start free</Link>
            </div>
          </nav>
        </header>

        <section className={styles.hero} aria-labelledby="homepage-title">
          <div className={styles.heroGlowOne} aria-hidden="true" />
          <div className={styles.heroGlowTwo} aria-hidden="true" />

          <div className={styles.heroContent}>
            <p className={styles.badge}>AI co-founder for startup validation</p>
            <h1 id="homepage-title" className={styles.title}>
              Validate startup ideas before you waste months building
            </h1>
            <p className={styles.subtitle}>
              StartupX AI helps founders assess market demand, competitors, pricing,
              user psychology, risks, and growth strategy before committing time and money.
            </p>
            <p className={styles.proofLine}>
              Built for student founders, hackathon teams, indie builders, and early SaaS teams.
            </p>

            <div className={styles.conversionCard}>
              <div>
                <h2>Run your first startup assessment</h2>
                <p>
                  Get a structured validation report covering demand, competitors,
                  pricing, risks, and growth.
                </p>
                <div className={styles.assessmentPreview} aria-label="Assessment preview">
                  <span>Demand signals <strong>Review</strong></span>
                  <span>Competitor gaps <strong>Mapped</strong></span>
                  <span>Pricing risk <strong>Flagged</strong></span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <Link className={styles.primaryButton} href="/signup">Start free</Link>
                <Link className={styles.secondaryButton} href="/pricing">View pricing</Link>
              </div>
            </div>

            <p className={styles.pricingPreview}>
              Starter free &middot; Founder $5/mo &middot; Growth $10/mo &middot; Scale $15/mo
            </p>
          </div>
        </section>

        <section id="features" className={styles.featureSection} aria-label="StartupX AI assessment areas">
          <div className={styles.featureGrid}>
            {featurePills.map((feature) => (
              <article className={styles.featureCard} key={feature}>
                <span>{feature}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className={styles.workflowSection} aria-labelledby="workflow-title">
          <div className={styles.sectionHeader}>
            <p>Founder workflow</p>
            <h2 id="workflow-title">Turn early confidence into a clearer next move.</h2>
          </div>
          <div className={styles.workflowGrid}>
            {workflowSteps.map(([number, label]) => (
              <article className={styles.workflowCard} key={number}>
                <span>{number}</span>
                <h3>{label}</h3>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className={styles.pricingSection} aria-labelledby="pricing-title">
          <div className={styles.sectionHeader}>
            <p>Simple pricing</p>
            <h2 id="pricing-title">Start free. Upgrade when your validation work grows.</h2>
          </div>
          <div className={styles.pricingActions}>
            <Link className={styles.primaryButton} href="/signup">Start free</Link>
            <Link className={styles.secondaryButton} href="/pricing">Compare plans</Link>
          </div>
          <div className={styles.planLinks} aria-label="Paid plan checkout links">
            <Link href="/payment?plan=founder">Founder</Link>
            <Link href="/payment?plan=growth">Growth</Link>
            <Link href="/payment?plan=scale">Scale</Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>&copy; {new Date().getFullYear()} StartupX AI. All rights reserved.</p>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
