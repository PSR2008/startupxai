"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Zap, AlertTriangle, CheckCircle2, TrendingUp, X } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { DecisionEngineOutput } from "@/types";

interface FormState { idea: string; description: string; targetAudience: string; currentStatus: string; biggestChallenge: string; resources: string; }
const defaultForm: FormState = { idea: "", description: "", targetAudience: "", currentStatus: "", biggestChallenge: "", resources: "" };

export default function DecisionEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<DecisionEngineOutput | null>(null);
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
      const res = await fetch("/api/analyze/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data); setStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<Target size={22} />} title="Founder Decision Engine" description="Get executive-level strategic clarity. Top 3 priorities, what not to build, fastest path to traction, and a confidence score — from your AI co-founder." badge="Intelligence Engine" badgeVariant="cocoa" accentColor="#7c3aed" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea label="Product Description" placeholder="What it does, how it works, and the core value." rows={4} value={form.description} onChange={set("description")} error={errors.description} required charCount maxChars={2000} />
            <Textarea label="Target Audience" placeholder="Who is your ideal customer?" rows={3} value={form.targetAudience} onChange={set("targetAudience")} error={errors.targetAudience} required />
            <Textarea label="Current Status" placeholder="Where are you right now? Idea stage? Beta? Users? Revenue?" rows={3} value={form.currentStatus} onChange={set("currentStatus")} hint="Optional — more context = better advice" />
            <Textarea label="Biggest Challenge" placeholder="What's blocking you most right now?" rows={3} value={form.biggestChallenge} onChange={set("biggestChallenge")} hint="Optional" />
            <Input label="Resources / Constraints" placeholder="e.g. Solo founder, no funding, 3 months runway" value={form.resources} onChange={set("resources")} hint="Optional" />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Target size={15} />} iconPosition="right">
            {status === "loading" ? "Processing Decision…" : "Get Founder Decision"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-ivory-950/40 border border-ivory-800/30 flex items-center justify-center"><Target size={20} className="text-gray-700" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Awaiting your context</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Give the engine your full founder context for the most accurate strategic guidance.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="decision" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Confidence score + Verdict */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-6">
                  <div className="flex items-start gap-6 flex-wrap">
                    <ScoreRing score={result.confidenceScore} label="Confidence Score" sublabel={result.confidenceScore >= 70 ? "High Conviction" : result.confidenceScore >= 50 ? "Moderate" : "Low Conviction"} size={110} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2"><Target size={14} className="text-gray-600" /><span className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Final Verdict</span></div>
                      <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.finalVerdict}</p>
                    </div>
                  </div>
                </div>

                {/* Founder summary */}
                <div className="rounded-2xl border border-ivory-800/20 bg-ivory-950/10 p-5">
                  <div className="flex items-center gap-2 mb-2"><Zap size={14} className="text-gray-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Founder Brief</h4></div>
                  <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.founderSummary}</p>
                </div>

                {/* Top 3 priorities */}
                {result.top3Priorities.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><CheckCircle2 size={14} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Top 3 Priorities</h4></div>
                    <div className="space-y-3">
                      {result.top3Priorities.map((p) => (
                        <div key={p.rank} className="flex gap-3 p-4 rounded-xl border border-black/5 bg-gray-50">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                            <span className="font-bricolage text-xs font-bold text-emerald-600">{p.rank}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-bricolage text-sm font-bold text-gray-900">{p.priority}</p>
                              <span className="font-jakarta text-xs text-gray-400 flex-shrink-0">{p.timeframe}</span>
                            </div>
                            <p className="font-jakarta text-xs text-gray-500">{p.why}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key strategic cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp size={13} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-emerald-600 uppercase">Fix First</h4></div>
                    <p className="font-jakarta text-sm text-gray-600">{result.whatToFixFirst}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle size={13} className="text-rose-500" /><h4 className="font-bricolage text-xs font-bold text-rose-500 uppercase">Biggest Mistake</h4></div>
                    <p className="font-jakarta text-sm text-gray-600">{result.biggestStrategicMistake}</p>
                  </div>
                </div>

                {/* Fastest path + Don't build */}
                <div className="rounded-2xl border border-midnight-800/20 bg-blue-50 p-5">
                  <div className="flex items-center gap-2 mb-2"><Zap size={13} className="text-blue-600" /><h4 className="font-bricolage text-xs font-bold text-blue-600 uppercase tracking-wide">Fastest Path to Traction</h4></div>
                  <p className="font-jakarta text-sm text-gray-600">{result.fastestPathToTraction}</p>
                </div>

                {result.whatNotToBuildYet.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><X size={13} className="text-rose-500" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Don&apos;t Build Yet</h4></div>
                    <div className="flex flex-wrap gap-2">{result.whatNotToBuildYet.map((w, i) => <Badge key={i} variant="peach" dot>{w}</Badge>)}</div>
                  </div>
                )}

                {/* Action steps */}
                {result.actionableNextSteps.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><CheckCircle2 size={14} className="text-teal-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Actionable Next Steps</h4></div>
                    <div className="space-y-2">{result.actionableNextSteps.map((s, i) => (
                      <div key={i} className="flex gap-3 items-start p-3 rounded-xl border border-black/4 hover:bg-gray-50 transition-colors">
                        <span className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="font-mono text-[9px] font-bold text-teal-600">{i + 1}</span></span>
                        <p className="font-jakarta text-sm text-gray-600">{s}</p>
                      </div>
                    ))}</div>
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
