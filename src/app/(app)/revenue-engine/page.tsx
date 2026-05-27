"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  Layers,
  LineChart,
  ReceiptText,
  TrendingUp,
  Zap,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { PricingTier, RevenueEngineOutput } from "@/types";
import { cn } from "@/lib/utils";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";

interface FormState {
  idea: string;
  description: string;
  targetAudience: string;
  currentPricing: string;
  businessModel: string;
}

const defaultForm: FormState = {
  idea: "",
  description: "",
  targetAudience: "",
  currentPricing: "",
  businessModel: "",
};

export default function RevenueEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<RevenueEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.idea.trim()) e.idea = "Required";
    if (!form.description.trim()) e.description = "Required";
    if (!form.targetAudience.trim()) e.targetAudience = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    setCopied(false);

    try {
      const res = await fetch("/api/analyze/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Revenue analysis failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("revenue");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Revenue analysis failed");
      setStatus("error");
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const copyReport = async () => {
    if (!result) return;

    const report = [
      "StartupX AI - Revenue Strategy Report",
      "",
      `Idea: ${form.idea}`,
      `Audience: ${form.targetAudience}`,
      form.currentPricing ? `Current Pricing: ${form.currentPricing}` : "",
      form.businessModel ? `Business Model: ${form.businessModel}` : "",
      "",
      "Revenue Verdict",
      result.revenueVerdict,
      "",
      "Recommended Pricing Tiers",
      ...result.pricingSuggestions.map(
        (tier) =>
          `- ${tier.name}: ${tier.price} / ${tier.billingCycle}\n  Segment: ${tier.targetSegment}\n  Features: ${tier.features.join(", ")}${tier.recommended ? "\n  Recommended: yes" : ""}`,
      ),
      "",
      "Revenue Leaks",
      ...result.revenueLeaks.map((leak) => `- ${leak}`),
      "",
      "Conversion Blockers",
      ...result.conversionBlockers.map((blocker) => `- ${blocker}`),
      "",
      "Psychological Pricing Tips",
      ...result.psychologicalPricingTips.map((tip) => `- ${tip}`),
      "",
      "Upsell Opportunities",
      ...result.upsellOpportunities.map((opportunity) => `- ${opportunity}`),
      "",
      "Monetization Model Fit",
      ...result.monetizationModels.map((model) => `- ${model.model}: ${model.fitScore}/100 fit. ${model.description}`),
    ]
      .filter((line) => line !== "")
      .join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <EngineHeader
        icon={<DollarSign size={22} />}
        title="Revenue Engine"
        description="Turn your startup context into pricing tiers, monetization fit, conversion risks, and high-leverage revenue moves."
        badge="Intelligence Engine"
        badgeVariant="forest"
        accentColor="#059669"
      />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ContextCard icon={<ReceiptText size={16} />} title="Pricing tiers" detail="Package the offer by segment" tone="emerald" />
        <ContextCard icon={<Layers size={16} />} title="Model fit" detail="Score monetization paths" tone="amber" />
        <ContextCard icon={<LineChart size={16} />} title="Revenue lift" detail="Find leaks and upsells" tone="blue" />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bricolage text-base font-bold text-gray-900">Revenue context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Describe the offer, buyer, and any pricing assumptions.</p>
              </div>
              <Badge variant="forest" size="sm">
                3 required
              </Badge>
            </div>

            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea
              label="Product Description"
              placeholder="Describe your product, features, and value proposition."
              rows={4}
              value={form.description}
              onChange={set("description")}
              error={errors.description}
              required
              charCount
              maxChars={2000}
            />
            <Textarea
              label="Target Audience"
              placeholder="Who pays for this? Be specific."
              rows={3}
              value={form.targetAudience}
              onChange={set("targetAudience")}
              error={errors.targetAudience}
              required
            />
            <Input label="Current Pricing" placeholder="e.g. $29/mo flat, or none yet" value={form.currentPricing} onChange={set("currentPricing")} hint="Optional - leave blank if none" />
            <Input label="Business Model" placeholder="e.g. Subscription SaaS, marketplace, per-seat" value={form.businessModel} onChange={set("businessModel")} hint="Optional" />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<DollarSign size={15} />} iconPosition="right">
            {status === "loading" ? "Building revenue strategy..." : "Run Revenue Analysis"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center shadow-sm shadow-gray-200/40"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50">
                  <DollarSign size={22} className="text-teal-600" />
                </div>
                <p className="mt-4 font-bricolage text-base font-bold text-gray-900">Ready to shape the money model</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Fill in the basics to get pricing tiers, revenue leaks, conversion blockers, model fit, and upsell paths.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Pricing", "Leaks", "Upsells"].map((label) => (
                    <Badge key={label} variant="forest" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="revenue" />
              </motion.div>
            )}

            {status === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ErrorState message={errorMessage} onRetry={() => setStatus("idle")} />
              </motion.div>
            )}

            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bricolage text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">Revenue report</p>
                      <h3 className="mt-1 font-bricolage text-xl font-bold text-gray-950">{form.idea || "Revenue strategy"}</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyReport} icon={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}>
                      {copied ? "Copied" : "Copy report"}
                    </Button>
                  </div>

                  <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp size={14} className="text-teal-700" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-teal-800">Revenue Verdict</h4>
                    </div>
                    <p className="font-jakarta text-sm leading-relaxed text-gray-650">{result.revenueVerdict}</p>
                  </div>
                </div>

                {result.pricingSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-bricolage text-sm font-bold text-gray-900">Recommended Pricing Tiers</h3>
                      <Badge variant="forest" size="sm">
                        {result.pricingSuggestions.length} tiers
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {result.pricingSuggestions.map((tier) => (
                        <PricingCard key={tier.name} tier={tier} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InsightList icon={<AlertTriangle size={13} />} title="Revenue Leaks" items={result.revenueLeaks} variant="peach" />
                  <InsightList icon={<AlertTriangle size={13} />} title="Conversion Blockers" items={result.conversionBlockers} variant="midnight" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap size={13} className="text-amber-700" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Psych Pricing Tips</h4>
                    </div>
                    <div className="space-y-2">
                      {result.psychologicalPricingTips.map((tip, index) => (
                        <div key={index} className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                          <ArrowRight size={13} className="mt-0.5 flex-shrink-0 text-amber-700" />
                          <p className="font-jakarta text-xs leading-relaxed text-gray-600">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <InsightList icon={<TrendingUp size={13} />} title="Upsell Opportunities" items={result.upsellOpportunities} variant="sage" />
                </div>

                {result.monetizationModels.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <Layers size={14} className="text-teal-700" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Monetization Model Fit</h4>
                    </div>
                    <div className="space-y-3">
                      {[...result.monetizationModels]
                        .sort((a, b) => b.fitScore - a.fitScore)
                        .map((model) => (
                          <div key={model.model} className="rounded-xl border border-black/6 bg-gray-50 p-4">
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <span className="font-bricolage text-sm font-bold text-gray-950">{model.model}</span>
                              <span className="font-bricolage text-xs font-bold" style={{ color: scoreColor(model.fitScore) }}>
                                {model.fitScore}/100 fit
                              </span>
                            </div>
                            <p className="mb-3 font-jakarta text-xs leading-relaxed text-gray-500">{model.description}</p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                              <div className="h-full rounded-full" style={{ width: `${model.fitScore}%`, background: scoreColor(model.fitScore) }} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ContextCard({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "emerald" | "amber" | "blue" }) {
  const toneClasses = {
    emerald: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-black/6 bg-white p-4 shadow-sm shadow-gray-200/40">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>{icon}</div>
      <div>
        <p className="font-bricolage text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>
    </div>
  );
}

function InsightList({ icon, title, items, variant }: { icon: React.ReactNode; title: string; items: string[]; variant: "peach" | "midnight" | "sage" }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn(variant === "peach" && "text-rose-500", variant === "midnight" && "text-blue-600", variant === "sage" && "text-emerald-600")}>{icon}</span>
        <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h4>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <Badge key={index} variant={variant} size="md" className="h-auto w-full justify-start whitespace-normal py-1.5 text-left">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border p-4",
        tier.recommended ? "border-teal-300 bg-teal-50 shadow-sm shadow-teal-100" : "border-black/6 bg-gray-50",
      )}
    >
      {tier.recommended && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-teal-700 px-2 py-0.5 font-bricolage text-[9px] font-bold text-white">Recommended</span>
        </div>
      )}
      <div>
        <p className="font-bricolage text-sm font-bold text-gray-950">{tier.name}</p>
        <p className="mt-1 font-bricolage text-2xl font-bold text-teal-700">{tier.price}</p>
        <p className="font-jakarta text-xs text-gray-500">{tier.billingCycle}</p>
      </div>
      <p className="font-jakarta text-xs leading-relaxed text-gray-500">{tier.targetSegment}</p>
      <div className="space-y-1.5">
        {tier.features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <Check size={11} className="mt-0.5 flex-shrink-0 text-teal-600" />
            <span className="font-jakarta text-xs leading-relaxed text-gray-600">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "#059669";
  if (score >= 50) return "#d97706";
  return "#e11d48";
}
