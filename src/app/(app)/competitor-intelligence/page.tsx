"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, ShieldAlert, TrendingUp, Target, Zap, ArrowRight, ExternalLink } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { CompetitorEngineOutput, Competitor } from "@/types";

interface FormState {
  idea: string;
  competitorNames: string;
  industry: string;
  startupUrl: string;
}

const defaultForm: FormState = { idea: "", competitorNames: "", industry: "", startupUrl: "" };

export default function CompetitorPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<CompetitorEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.idea.trim()) e.idea = "Startup idea is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/analyze/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Analysis failed");
      setResult(data.data);
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Analysis failed.");
      setStatus("error");
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<Swords size={22} />} title="Competitor Intelligence Engine" description="Map your competitive landscape. Find weaknesses, exploit positioning gaps, and discover white-space opportunities your rivals are sleeping on." badge="Intelligence Engine" badgeVariant="cocoa" accentColor="#f59e0b" />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <h3 className="font-bricolage text-sm font-bold text-gray-800">Your Context</h3>
            <Input label="Your Startup Idea" placeholder="e.g. B2B SaaS for restaurant inventory management" value={form.idea} onChange={set("idea")} error={errors.idea} required hint="What you're building" />
            <Textarea label="Known Competitors" placeholder="e.g. MarketMan, BlueCart, Lightspeed, Toast POS (leave blank if unknown)" rows={3} value={form.competitorNames} onChange={set("competitorNames")} hint="Optional — separate with commas" />
            <Input label="Industry" placeholder="e.g. Restaurant Tech, Food & Beverage SaaS" value={form.industry} onChange={set("industry")} hint="Optional but improves accuracy" />
            <Input label="Your Product URL" type="url" placeholder="https://yourstartup.com" value={form.startupUrl} onChange={set("startupUrl")} hint="Optional" />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Swords size={15} />} iconPosition="right">
            {status === "loading" ? "Mapping Competitors…" : "Run Competitor Analysis"}
          </Button>
        </div>

        {/* Output */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center"><Swords size={20} className="text-amber-600" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Ready to map</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Enter your idea and click Run Competitor Analysis to get a full competitive map.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="competitor" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Strategic summary */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-6">
                  <h3 className="font-bricolage text-sm font-bold text-gray-800 mb-3">Competitive Landscape Summary</h3>
                  <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.comparisonSummary}</p>
                  <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="font-bricolage text-xs font-bold text-amber-700 mb-1.5">Your Strategic Advantage</p>
                    <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.strategicAdvantage}</p>
                  </div>
                </div>

                {/* Competitors */}
                {result.directCompetitors.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={13} className="text-rose-500" /> Direct Competitors</h4>
                    {result.directCompetitors.map((c) => <CompetitorCard key={c.name} competitor={c} variant="direct" />)}
                  </div>
                )}
                {result.indirectCompetitors.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Target size={13} className="text-blue-600" /> Indirect Competitors</h4>
                    {result.indirectCompetitors.map((c) => <CompetitorCard key={c.name} competitor={c} variant="indirect" />)}
                  </div>
                )}

                {/* Gaps & Strategy */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><TrendingUp size={14} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Positioning Gaps</h4></div>
                    <div className="space-y-2">{result.positioningGaps.map((g, i) => <Badge key={i} variant="sage" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{g}</Badge>)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Zap size={14} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">White Space Opportunities</h4></div>
                    <div className="space-y-2">{result.whiteSpaceOpportunities.map((g, i) => <Badge key={i} variant="cocoa" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{g}</Badge>)}</div>
                  </div>
                </div>

                {/* How to beat */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 mb-3"><Swords size={14} className="text-teal-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">How to Beat Them</h4></div>
                  <div className="space-y-2">{result.howToBeatThem.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-forest-950/20 border border-teal-200">
                      <span className="font-bricolage text-xs font-bold text-teal-700 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                      <p className="font-jakarta text-sm text-gray-600">{s}</p>
                    </div>
                  ))}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CompetitorCard({ competitor, variant }: { competitor: Competitor; variant: "direct" | "indirect" }) {
  const color = variant === "direct" ? "#ec6e38" : "#4a63b5";
  return (
    <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bricolage text-sm font-bold text-gray-900">{competitor.name}</span>
            {competitor.url && <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600"><ExternalLink size={12} /></a>}
          </div>
          <p className="font-jakarta text-xs text-gray-400 mt-0.5">{competitor.description}</p>
        </div>
        <Badge variant={variant === "direct" ? "peach" : "midnight"} size="sm">{variant}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-bricolage text-[10px] font-bold text-emerald-700 uppercase mb-1.5">Strengths</p>
          {competitor.strengths.map((s, i) => <p key={i} className="font-jakarta text-xs text-gray-500 flex gap-1.5 mb-1"><span style={{ color: "#72845e" }}>+</span>{s}</p>)}
        </div>
        <div>
          <p className="font-bricolage text-[10px] font-bold text-rose-500 uppercase mb-1.5">Weaknesses</p>
          {competitor.weaknesses.map((w, i) => <p key={i} className="font-jakarta text-xs text-gray-500 flex gap-1.5 mb-1"><span style={{ color }}>−</span>{w}</p>)}
        </div>
      </div>
    </div>
  );
}
