"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, AlertTriangle, TrendingUp, Zap, Check, ArrowRight } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { RevenueEngineOutput, PricingTier } from "@/types";
import { cn } from "@/lib/utils";

interface FormState { idea: string; description: string; targetAudience: string; currentPricing: string; businessModel: string; }
const defaultForm: FormState = { idea: "", description: "", targetAudience: "", currentPricing: "", businessModel: "" };

export default function RevenueEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<RevenueEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
    try {
      const res = await fetch("/api/analyze/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data); setStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<DollarSign size={22} />} title="Revenue Engine" description="Get pricing tiers, monetization models, psychological pricing tactics, revenue leaks, and conversion blockers — tailored to your startup." badge="Intelligence Engine" badgeVariant="forest" accentColor="#059669" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea label="Product Description" placeholder="Describe your product, features, and value proposition." rows={4} value={form.description} onChange={set("description")} error={errors.description} required charCount maxChars={2000} />
            <Textarea label="Target Audience" placeholder="Who pays for this? Be specific." rows={3} value={form.targetAudience} onChange={set("targetAudience")} error={errors.targetAudience} required />
            <Input label="Current Pricing" placeholder="e.g. $29/mo flat, or 'none yet'" value={form.currentPricing} onChange={set("currentPricing")} hint="Optional — leave blank if none" />
            <Input label="Business Model" placeholder="e.g. Subscription SaaS, marketplace, per-seat" value={form.businessModel} onChange={set("businessModel")} hint="Optional" />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<DollarSign size={15} />} iconPosition="right">
            {status === "loading" ? "Building Revenue Strategy…" : "Run Revenue Analysis"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-forest-950/40 border border-teal-200 flex items-center justify-center"><DollarSign size={20} className="text-teal-600" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Revenue strategy pending</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Fill in your details and run the analysis to get pricing tiers and monetization models.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="revenue" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Pricing tiers */}
                {result.pricingSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-6">
                    <h3 className="font-bricolage text-sm font-bold text-gray-800 mb-4">Recommended Pricing Tiers</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {result.pricingSuggestions.map((tier) => <PricingCard key={tier.name} tier={tier} />)}
                    </div>
                  </div>
                )}

                {/* Revenue verdict */}
                <div className="rounded-2xl border border-teal-200 bg-forest-950/20 p-5">
                  <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} className="text-teal-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Revenue Verdict</h4></div>
                  <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.revenueVerdict}</p>
                </div>

                {/* Revenue leaks & Blockers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><AlertTriangle size={13} className="text-rose-500" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Revenue Leaks</h4></div>
                    <div className="space-y-2">{result.revenueLeaks.map((l, i) => <Badge key={i} variant="peach" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{l}</Badge>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><AlertTriangle size={13} className="text-blue-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Conversion Blockers</h4></div>
                    <div className="space-y-2">{result.conversionBlockers.map((b, i) => <Badge key={i} variant="midnight" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{b}</Badge>)}</div>
                  </div>
                </div>

                {/* Psych pricing & Upsells */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Zap size={13} className="text-gray-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Psych Pricing Tips</h4></div>
                    <div className="space-y-2">{result.psychologicalPricingTips.map((t, i) => <div key={i} className="flex gap-2 items-start"><span className="font-bricolage text-xs text-gray-700 font-bold mt-0.5">→</span><p className="font-jakarta text-xs text-gray-500">{t}</p></div>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><TrendingUp size={13} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Upsell Opportunities</h4></div>
                    <div className="space-y-2">{result.upsellOpportunities.map((u, i) => <Badge key={i} variant="sage" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{u}</Badge>)}</div>
                  </div>
                </div>

                {/* Monetization models */}
                {result.monetizationModels.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-4">Monetization Model Fit</h4>
                    <div className="space-y-3">
                      {result.monetizationModels.sort((a, b) => b.fitScore - a.fitScore).map((m) => (
                        <div key={m.model} className="p-4 rounded-xl border border-black/6 bg-gray-50">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bricolage text-sm font-bold text-gray-900">{m.model}</span>
                            <span className="font-bricolage text-xs font-bold" style={{ color: m.fitScore >= 70 ? "#72845e" : m.fitScore >= 50 ? "#c9b47a" : "#ec6e38" }}>
                              {m.fitScore}/100 fit
                            </span>
                          </div>
                          <p className="font-jakarta text-xs text-gray-400 mb-2">{m.description}</p>
                          <div className="w-full h-1 rounded-full bg-gray-100/80 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${m.fitScore}%`, background: m.fitScore >= 70 ? "#72845e" : m.fitScore >= 50 ? "#c9b47a" : "#ec6e38" }} />
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

function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-3 relative", tier.recommended ? "border-teal-200 bg-forest-950/20" : "border-black/6 bg-gray-50")}>
      {tier.recommended && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2"><span className="font-bricolage text-[9px] font-bold px-2 py-0.5 rounded-full bg-forest-700 text-white">Recommended</span></div>}
      <div>
        <p className="font-bricolage text-sm font-bold text-gray-900">{tier.name}</p>
        <p className="font-bricolage text-2xl font-bold text-teal-600">{tier.price}</p>
        <p className="font-jakarta text-xs text-gray-400">{tier.billingCycle}</p>
      </div>
      <p className="font-jakarta text-xs text-gray-400">{tier.targetSegment}</p>
      <div className="space-y-1.5">{tier.features.map((f, i) => (
        <div key={i} className="flex items-start gap-2"><Check size={11} className="text-teal-600 mt-0.5 flex-shrink-0" /><span className="font-jakarta text-xs text-gray-600">{f}</span></div>
      ))}</div>
    </div>
  );
}
