"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Users, MessageSquare, Zap, Target, CheckCircle2 } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea, Select } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { GrowthEngineOutput, GrowthChannel } from "@/types";
import { cn } from "@/lib/utils";

const budgetOptions = [
  { value: "", label: "Select budget range" },
  { value: "bootstrap", label: "Bootstrapped / $0" },
  { value: "under-1k", label: "Under $1,000/mo" },
  { value: "1k-10k", label: "$1,000–$10,000/mo" },
  { value: "10k-50k", label: "$10,000–$50,000/mo" },
  { value: "50k+", label: "$50,000+/mo" },
];

const stageOptions = [
  { value: "", label: "Select stage" },
  { value: "idea", label: "Idea Stage" },
  { value: "pre-product", label: "Pre-product" },
  { value: "beta", label: "Beta / Soft Launch" },
  { value: "launched", label: "Launched" },
  { value: "growing", label: "Growing" },
];

const effortColor: Record<string, string> = { low: "#72845e", medium: "#c9b47a", high: "#ec6e38" };
const impactColor: Record<string, string> = { low: "#6b5f55", medium: "#c9b47a", high: "#72845e" };

interface FormState { idea: string; description: string; targetAudience: string; currentChannels: string; budget: string; stage: string; }
const defaultForm: FormState = { idea: "", description: "", targetAudience: "", currentChannels: "", budget: "", stage: "" };

export default function GrowthEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<GrowthEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.idea.trim()) e.idea = "Required";
    if (!form.description.trim()) e.description = "Required";
    if (!form.targetAudience.trim()) e.targetAudience = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/analyze/growth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data); setStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<TrendingUp size={22} />} title="Growth Engine" description="Get your first 10 customers. Channel recommendations, audience segments, content hooks, launch steps, and outreach directions — built for your stage." badge="Intelligence Engine" badgeVariant="midnight" accentColor="#2563eb" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea label="Product Description" placeholder="What does it do? What pain does it solve?" rows={4} value={form.description} onChange={set("description")} error={errors.description} required charCount maxChars={2000} />
            <Textarea label="Target Audience" placeholder="Who needs this most? Be specific." rows={3} value={form.targetAudience} onChange={set("targetAudience")} error={errors.targetAudience} required />
            <Select label="Stage" options={stageOptions} value={form.stage} onChange={set("stage")} placeholder="Select stage" />
            <Select label="Monthly Budget" options={budgetOptions} value={form.budget} onChange={set("budget")} placeholder="Select budget range" />
            <Input label="Current Channels" placeholder="e.g. LinkedIn, cold email, referrals" value={form.currentChannels} onChange={set("currentChannels")} hint="Optional — what you're already trying" />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<TrendingUp size={15} />} iconPosition="right">
            {status === "loading" ? "Building Growth Plan…" : "Run Growth Analysis"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-midnight-800/30 flex items-center justify-center"><TrendingUp size={20} className="text-blue-600" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Growth plan pending</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Fill in your startup details for a tactical, stage-specific growth plan.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="growth" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* First 10 customers */}
                {result.first10CustomersPlan.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-6">
                    <div className="flex items-center gap-2 mb-4"><Target size={15} className="text-blue-600" /><h3 className="font-bricolage text-sm font-bold text-gray-800">First 10 Customers Plan</h3></div>
                    <div className="space-y-3">
                      {result.first10CustomersPlan.map((step) => (
                        <div key={step.step} className="flex gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-midnight-800/30 flex items-center justify-center flex-shrink-0">
                            <span className="font-bricolage text-xs font-bold text-blue-600">{String(step.step).padStart(2, "0")}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bricolage text-sm font-semibold text-gray-900">{step.action}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="font-jakarta text-xs text-gray-400">{step.timeline}</span>
                              <span className="font-jakarta text-xs text-blue-600">{step.expectedOutcome}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channels */}
                {result.channelSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><Zap size={14} className="text-blue-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Channel Stack</h4></div>
                    <div className="space-y-3">
                      {result.channelSuggestions.map((ch) => <ChannelCard key={ch.channel} channel={ch} />)}
                    </div>
                  </div>
                )}

                {/* Outreach direction */}
                {result.outreachDirection && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><MessageSquare size={14} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Outreach Direction</h4></div>
                    <div className="space-y-3">
                      {[
                        { label: "WhatsApp", value: result.outreachDirection.whatsapp, color: "#72845e" },
                        { label: "LinkedIn", value: result.outreachDirection.linkedin, color: "#2563eb" },
                        { label: "Email", value: result.outreachDirection.email, color: "#9e724e" },
                      ].map((ch) => (
                        <div key={ch.label} className="p-3 rounded-xl border border-black/5 bg-gray-50">
                          <p className="font-bricolage text-xs font-bold mb-1" style={{ color: ch.color }}>{ch.label}</p>
                          <p className="font-jakarta text-sm text-gray-600">{ch.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content hooks & CAC priorities */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Zap size={13} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Content Hooks</h4></div>
                    <div className="space-y-2">{result.contentHooks.map((h, i) => <div key={i} className="flex gap-2 items-start"><span className="font-bricolage text-xs font-bold text-amber-700">→</span><p className="font-jakarta text-xs text-gray-500">{h}</p></div>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Target size={13} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">CAC Priorities</h4></div>
                    <div className="space-y-2">{result.customerAcquisitionPriorities.map((p, i) => <Badge key={i} variant="sage" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{p}</Badge>)}</div>
                  </div>
                </div>

                {/* Launch steps */}
                {result.launchSteps.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><CheckCircle2 size={14} className="text-teal-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Launch Steps</h4></div>
                    <div className="space-y-2">{result.launchSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="font-mono text-[9px] font-bold text-teal-600">{i + 1}</span></span>
                        <p className="font-jakarta text-sm text-gray-600">{s}</p>
                      </div>
                    ))}</div>
                  </div>
                )}

                {/* Audience segments */}
                {result.audienceSegments.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Users size={14} className="text-blue-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Audience Segments</h4></div>
                    <div className="flex flex-wrap gap-2">{result.audienceSegments.map((s, i) => <Badge key={i} variant="midnight" dot>{s}</Badge>)}</div>
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

function ChannelCard({ channel }: { channel: GrowthChannel }) {
  return (
    <div className="p-4 rounded-xl border border-black/6 bg-gray-50">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bricolage text-sm font-bold text-gray-900">{channel.channel}</p>
        <div className="flex gap-1.5">
          <span className="font-bricolage text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: effortColor[channel.effort], borderColor: `${effortColor[channel.effort]}40`, background: `${effortColor[channel.effort]}10` }}>Effort: {channel.effort}</span>
          <span className="font-bricolage text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: impactColor[channel.impact], borderColor: `${impactColor[channel.impact]}40`, background: `${impactColor[channel.impact]}10` }}>Impact: {channel.impact}</span>
        </div>
      </div>
      <p className="font-jakarta text-xs text-gray-400 mb-2">{channel.description}</p>
      <div className="flex flex-wrap gap-1.5">{channel.tactics.map((t, i) => <span key={i} className={cn("font-bricolage text-[10px] font-medium px-2 py-0.5 rounded-full border border-midnight-700/30 bg-blue-50 text-blue-600")}>{t}</span>)}</div>
    </div>
  );
}
