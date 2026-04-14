"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, Zap, Eye, ShieldCheck, Frown } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { PsychologyEngineOutput } from "@/types";

interface FormState { idea: string; description: string; targetAudience: string; productUrl: string; currentCopy: string; }
const defaultForm: FormState = { idea: "", description: "", targetAudience: "", productUrl: "", currentCopy: "" };

export default function PsychologyPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<PsychologyEngineOutput | null>(null);
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
      const res = await fetch("/api/analyze/psychology", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data); setStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<Brain size={22} />} title="User Psychology Engine" description="Get a brutal, honest audit of your trust signals, UX, and copy. Understand exactly why users won't buy — and what to fix first." badge="Intelligence Engine" badgeVariant="peach" accentColor="#f43f5e" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea label="Product Description" placeholder="Your product, value prop, key features." rows={4} value={form.description} onChange={set("description")} error={errors.description} required charCount maxChars={2000} />
            <Textarea label="Target Audience" placeholder="Who is your target user? Their pain points?" rows={3} value={form.targetAudience} onChange={set("targetAudience")} error={errors.targetAudience} required />
            <Input label="Product URL" type="url" placeholder="https://yourstartup.com" value={form.productUrl} onChange={set("productUrl")} hint="Optional — significantly improves accuracy" />
            <Textarea label="Current Homepage Copy" placeholder="Paste your hero heading, subheading, or key messaging here…" rows={4} value={form.currentCopy} onChange={set("currentCopy")} hint="Optional — paste your headline/subheadline" charCount maxChars={2000} />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Brain size={15} />} iconPosition="right">
            {status === "loading" ? "Profiling Users…" : "Run Psychology Analysis"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center"><Brain size={20} className="text-rose-500" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Psychology audit pending</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Get an honest UX roast and trust score.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="psychology" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Trust score + Roast */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-6">
                  <div className="flex items-center gap-8 flex-wrap">
                    <ScoreRing score={result.trustScore} label="Trust Score" sublabel={result.trustScore >= 70 ? "Trustworthy" : result.trustScore >= 50 ? "Needs Work" : "Low Trust"} size={110} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2"><Frown size={14} className="text-rose-500" /><span className="font-bricolage text-xs font-bold text-rose-500 uppercase tracking-wide">Brutal Roast</span></div>
                      <p className="font-jakarta text-sm text-gray-600 leading-relaxed italic">&ldquo;{result.brutalRoast}&rdquo;</p>
                    </div>
                  </div>
                </div>

                {/* Credibility & Friction */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><AlertTriangle size={13} className="text-rose-500" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Credibility Gaps</h4></div>
                    <div className="space-y-2">{result.credibilityGaps.map((g, i) => <Badge key={i} variant="peach" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{g}</Badge>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Eye size={13} className="text-blue-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Friction Points</h4></div>
                    <div className="space-y-2">{result.frictionPoints.map((f, i) => <Badge key={i} variant="midnight" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{f}</Badge>)}</div>
                  </div>
                </div>

                {/* First impression & Copy issues */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Eye size={13} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">First Impression Issues</h4></div>
                    <div className="space-y-2">{result.firstImpressionIssues.map((f, i) => <Badge key={i} variant="cocoa" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{f}</Badge>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Brain size={13} className="text-blush-400" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Copy / Messaging Issues</h4></div>
                    <div className="space-y-2">{result.confusingCopyIssues.map((c, i) => <Badge key={i} variant="blush" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{c}</Badge>)}</div>
                  </div>
                </div>

                {/* Emotional objections */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 mb-3"><Frown size={13} className="text-rose-500" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Emotional Objections Users Have</h4></div>
                  <div className="flex flex-wrap gap-2">{result.emotionalObjections.map((o, i) => <Badge key={i} variant="peach" dot>{o}</Badge>)}</div>
                </div>

                {/* UX recommendations & Trust actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Zap size={13} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">UX Recommendations</h4></div>
                    <div className="space-y-2">{result.uxRecommendations.map((r, i) => <div key={i} className="flex gap-2.5 items-start"><span className="font-bricolage text-xs font-bold text-emerald-700 mt-0.5">→</span><p className="font-jakarta text-xs text-gray-500">{r}</p></div>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><ShieldCheck size={13} className="text-teal-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Trust Building Actions</h4></div>
                    <div className="space-y-2">{result.trustBuildingActions.map((t, i) => <Badge key={i} variant="forest" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{t}</Badge>)}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
