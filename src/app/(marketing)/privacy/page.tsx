import type { Metadata } from "next";
import AnimatedSection from "@/components/shared/AnimatedSection";

export const metadata: Metadata = {
  title: "Privacy Policy - StartupX AI",
  description: "How StartupX AI collects, uses, and protects your data.",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly, including startup ideas, product descriptions, and target audience details entered into our analysis engines. We also collect session identifiers, IP addresses (hashed for privacy), and usage analytics to improve our service.

If you create an account, we collect your email address and any profile information you voluntarily provide.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `Your input data is used solely to generate assessment results inside your workspace. We do not sell, rent, or share your startup ideas with third parties.

Analysis inputs are processed by Anthropic's Claude API under their data processing agreement. We retain anonymized usage logs for product improvement and security monitoring.`,
  },
  {
    title: "3. Data Retention",
    content: `Analysis results are stored in your session for the duration of your browser session. If you have an account, saved analyses are retained until you delete them or close your account.

IP addresses are stored in hashed form for rate limiting and abuse prevention. Raw IP data is never stored.`,
  },
  {
    title: "4. Third-Party Services",
    content: `StartupX AI uses the following third-party services:

* Anthropic Claude API - for AI analysis and content generation
* Supabase - for authentication and database storage
* Vercel - for hosting and edge infrastructure
* Razorpay - for payment processing

We do not use advertising networks, retargeting pixels, or invasive tracking technologies.`,
  },
  {
    title: "5. Cookies and Tracking",
    content: `We use minimal, necessary cookies only:

* Session cookies to maintain your authenticated session
* Security cookies to help prevent abuse
* Preference cookies if you customize display settings

We do not use advertising cookies or retargeting pixels.`,
  },
  {
    title: "6. Security",
    content: `We take security seriously. Measures include:

* Data in transit encrypted with TLS
* API keys stored as server-side environment variables only
* Input validation on form submissions
* Rate limiting to prevent abuse
* IP addresses stored as one-way hashes only`,
  },
  {
    title: "7. Your Rights",
    content: `You have the right to:

* Access personal data we hold about you
* Request deletion of your data
* Export your analysis history where available
* Opt out of anonymized product analytics
* Lodge a complaint with your local data protection authority

To exercise these rights, contact us at privacy@startupxai.in.`,
  },
  {
    title: "8. Children's Privacy",
    content:
      "StartupX AI is not directed at children under 13 years of age. We do not knowingly collect personal information from children. If you believe a child has provided personal information, contact us immediately at privacy@startupxai.in.",
  },
  {
    title: "9. Changes to This Policy",
    content:
      "We may update this Privacy Policy periodically. We will notify users of material changes via email where appropriate and by posting a notice on our website. Continued use of the service after changes constitutes acceptance of the updated policy.",
  },
  {
    title: "10. Contact Us",
    content: `For privacy-related questions or requests:

Email: privacy@startupxai.in
Support: startupxai.in/support

We aim to respond to privacy inquiries within 48 hours.`,
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
            Last updated: May 27, 2026
          </p>
          <div className="mt-5 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
            <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
              <strong className="text-gray-900 font-bricolage">TL;DR:</strong>{" "}
              We do not sell your data. Your startup ideas stay private. We use minimal tracking, and you can request deletion of your data.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <AnimatedSection key={section.title} delay={i * 0.04}>
              <div className="rounded-2xl border border-black/6 bg-white p-6 sm:p-8 shadow-sm">
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
