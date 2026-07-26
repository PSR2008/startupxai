import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Assessment Methodology - StartupX AI",
  description:
    "How StartupX AI calculates evidence-backed assessments, confidence levels, missing evidence and limitations.",
};

const principles = [
  {
    title: "Evidence quality",
    body: "Higher-quality inputs carry more weight: customer interviews, completed experiments, dated source links and clearly attributed founder research are stronger than unsupported assumptions.",
  },
  {
    title: "Evidence quantity",
    body: "A score is less confident when only a few items support a claim. Small samples can point to a useful next test, but they should not be treated as proof of demand.",
  },
  {
    title: "Contradictions",
    body: "Supporting and contradicting evidence are reviewed separately. Contradictions reduce confidence and help identify what needs another interview, source or experiment.",
  },
  {
    title: "Freshness",
    body: "Recent evidence is generally more useful than stale inputs, especially for pricing, competitor positioning and customer acquisition assumptions.",
  },
];

const labels = [
  "Founder provided",
  "Customer interview",
  "Experiment result",
  "Public URL",
  "Imported source",
  "AI suggestion - unverified",
];

export default function MethodologyPage() {
  return (
    <div className="px-5 pb-20 pt-32">
      <div className="container-custom max-w-5xl">
        <section className="mb-14">
          <div className="mb-5 inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-1.5">
            <span className="font-jakarta text-xs font-semibold text-emerald-700">
              Methodology
            </span>
          </div>
          <h1 className="mb-5 font-bricolage text-5xl font-bold tracking-tight text-gray-950 sm:text-6xl">
            How assessments are calculated
          </h1>
          <p className="max-w-3xl font-jakarta text-lg leading-relaxed text-gray-600">
            StartupX AI turns founder inputs, attached evidence and experiment history into structured findings. It does not prove market demand or guarantee business success.
          </p>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {principles.map((item) => (
            <div key={item.title} className="surface-panel p-6">
              <h2 className="mb-2 font-bricolage text-lg font-bold text-gray-900">
                {item.title}
              </h2>
              <p className="font-jakarta text-sm leading-relaxed text-gray-600">
                {item.body}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-8 surface-panel p-6">
          <h2 className="mb-4 font-bricolage text-2xl font-bold tracking-tight text-gray-950">
            Verified, unverified and missing evidence
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((label) => (
              <div key={label} className="rounded-lg border border-black/8 bg-[#f8f6f0] px-3 py-2">
                <span className="font-mono text-[11px] font-semibold text-gray-600">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 font-jakarta text-sm leading-relaxed text-gray-600">
            AI-assisted suggestions are treated as generated assessments until a founder links real evidence. If evidence is weak, absent or one-sided, the product shows insufficient evidence and recommends the next validation action instead of presenting a precise conclusion.
          </p>
        </section>

        <section className="mb-10 surface-panel overflow-hidden">
          <div className="border-b border-black/8 bg-[#f8f6f0] p-5">
            <h2 className="font-bricolage text-2xl font-bold tracking-tight text-gray-950">
              What affects confidence
            </h2>
          </div>
          <div className="divide-y divide-black/6">
            {[
              "number of evidence items linked to the assumption",
              "source quality and attribution",
              "supporting versus contradicting evidence",
              "completed experiment outcomes",
              "missing interviews, public sources or measured results",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4">
                <CheckCircle2 size={16} className="mt-1 flex-shrink-0 text-emerald-600" />
                <p className="font-jakarta text-sm leading-relaxed text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <Link
          href="/signup?next=/evidence-engine"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-3 font-jakarta text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Start assessment
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
