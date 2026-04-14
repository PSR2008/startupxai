import type { Metadata } from "next";
import AnimatedSection from "@/components/shared/AnimatedSection";

export const metadata: Metadata = {
  title: "Privacy Policy — StartupX AI",
  description: "How StartupX AI collects, uses, and protects your data.",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly, including startup ideas, product descriptions, and target audience details entered into our analysis engines. We also collect session identifiers, IP addresses (hashed for privacy), and usage analytics to improve our service.

We do not require account creation to use the core features. If you choose to create an account, we collect your email address and any profile information you voluntarily provide.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `Your input data is used solely to generate AI-powered analysis results using our intelligence engines. We do not sell, rent, or share your startup ideas with third parties.

Analysis inputs are processed by Anthropic's Claude API under their data processing agreement. We retain anonymized usage logs for product improvement and security monitoring.`,
  },
  {
    title: "3. Data Retention",
    content: `Analysis results are stored in your session for the duration of your browser session. If you have an account, saved analyses are retained until you delete them or close your account.

IP addresses are stored in hashed form (non-reversible) for rate limiting and abuse prevention. Raw IP data is never stored.`,
  },
  {
    title: "4. Third-Party Services",
    content: `StartupX AI uses the following third-party services:

• Anthropic Claude API — for AI analysis and content generation. Governed by Anthropic's Privacy Policy.
• Supabase — for database storage. Data is stored in encrypted databases in the EU/US regions.
• Vercel — for hosting and edge infrastructure. Governed by Vercel's Privacy Policy.

We do not use advertising networks, tracking pixels, or third-party analytics beyond what is strictly necessary for product operation.`,
  },
  {
    title: "5. Cookies and Tracking",
    content: `We use minimal, necessary cookies only:

• Session cookies to maintain your analysis state
• Security cookies to prevent CSRF attacks
• Preference cookies if you customize display settings

We do not use advertising cookies, retargeting pixels, or invasive tracking technologies.`,
  },
  {
    title: "6. Security",
    content: `We take security seriously. Measures include:

• All data in transit encrypted with TLS 1.3
• API keys stored as server-side environment variables only — never exposed client-side
• Input validation and sanitization on all form submissions
• Rate limiting to prevent abuse
• Security headers (HSTS, CSP, X-Frame-Options) on all responses
• IP addresses stored as one-way hashes only`,
  },
  {
    title: "7. Your Rights",
    content: `You have the right to:

• Access any personal data we hold about you
• Request deletion of your data
• Export your analysis history (for account holders)
• Opt out of anonymized product analytics
• Lodge a complaint with your local data protection authority

To exercise these rights, contact us at privacy@startupxai.com`,
  },
  {
    title: "8. Children's Privacy",
    content: `StartupX AI is not directed at children under 13 years of age. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us immediately at privacy@startupxai.com.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this Privacy Policy periodically. We will notify users of material changes via email (for account holders) and by posting a notice on our website. Continued use of the service after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "10. Contact Us",
    content: `For privacy-related questions or requests:

Email: privacy@startupxai.com
Support: startupxai.com/support

We aim to respond to all privacy inquiries within 48 hours.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="pt-28 pb-20 px-5">
      <div className="max-w-3xl mx-auto">
        <AnimatedSection className="mb-12">
          <p className="font-bricolage text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4">
            Legal
          </p>
          <h1 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="font-jakarta text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <div className="mt-5 p-4 rounded-xl border border-sage-800/30 bg-sage-950/20">
            <p className="font-jakarta text-sm text-gray-500 leading-relaxed">
              <strong className="text-gray-800 font-bricolage">TL;DR:</strong>{" "}
              We don&apos;t sell your data. Your startup ideas stay private. We use minimal tracking.
              We take security seriously. You can delete your data any time.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <AnimatedSection key={section.title} delay={i * 0.04}>
              <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 sm:p-8">
                <h2 className="font-bricolage text-lg font-bold text-gray-800 mb-4">
                  {section.title}
                </h2>
                <div className="font-jakarta text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </div>
  );
}
