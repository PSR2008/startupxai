"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Copy,
  Lightbulb,
  ShieldAlert,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { DecisionEngineOutput } from "@/types";
import { logUsageClient } from "@/lib/usage-client";

interface FormState {
  idea: string;
  description: string;
  targetAudience: string;
  currentStatus: string;
  biggestChallenge: string;
  resources: string;
}

const defaultForm: FormState = {
  idea: "",
  description: "",
  targetAudience: "",
  currentStatus: "",
  biggestChallenge: "",
  resources: "",
};

export default function DecisionEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<DecisionEngineOutput | null>(null);
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
      const res = await fetch("/api/analyze/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Decision analysis failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("decision");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Decision analysis failed");
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
      "StartupX AI - Founder Decision Report",
      "",
      `Idea: ${form.idea}`,
      `Audience: ${form.targetAudience}`,
      form.currentStatus ? `Current Status: ${form.currentStatus}` : "",
      form.biggestChallenge ? `Biggest Challenge: ${form.biggestChallenge}` : "",
      form.resources ? `Resources / Constraints: ${form.resources}` : "",
      "",
      `Confidence Score: ${result.confidenceScore}/100`,
      "",
      "Final Verdict",
      result.finalVerdict,
      "",
      "Founder Brief",
      result.founderSummary,
      "",
      "Top 3 Priorities",
      ...result.top3Priorities.map((priority) => `${priority.rank}. ${priority.priority} (${priority.timeframe}) - ${priority.why}`),
      "",
      "Fix First",
      result.whatToFixFirst,
      "",
      "Biggest Strategic Mistake",
      result.biggestStrategicMistake,
      "",
      "Fastest Path to Traction",
      result.fastestPathToTraction,
      "",
      "Do Not Build Yet",
      ...result.whatNotToBuildYet.map((item) => `- ${item}`),
      "",
      "Actionable Next Steps",
      ...result.actionableNextSteps.map((step, index) => `${index + 1}. ${step}`),
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
        icon={<Target size={22} />}
        title="Founder Decision Engine"
        description="Get executive-level clarity on priorities, traction path, mistakes to avoid, and what not to build yet."
        badge="Intelligence Engine"
        badgeVariant="cocoa"
        accentColor="#7c3aed"
      />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ContextCard icon={<Compass size={16} />} title="Strategic verdict" detail="Clear direction and confidence" tone="violet" />
        <ContextCard icon={<ClipboardCheck size={16} />} title="Priorities" detail="What to execute first" tone="emerald" />
        <ContextCard icon={<ShieldAlert size={16} />} title="Avoid list" detail="Mistakes and scope traps" tone="rose" />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bricolage text-base font-bold text-gray-900">Founder context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">The sharper your constraints, the sharper the decision.</p>
              </div>
              <Badge variant="violet" size="sm">
                3 required
              </Badge>
            </div>

            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea
              label="Product Description"
              placeholder="What it does, how it works, and the core value."
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
              placeholder="Who is your ideal customer?"
              rows={3}
              value={form.targetAudience}
              onChange={set("targetAudience")}
              error={errors.targetAudience}
              required
            />
            <Textarea
              label="Current Status"
              placeholder="Where are you right now? Idea stage? Beta? Users? Revenue?"
              rows={3}
              value={form.currentStatus}
              onChange={set("currentStatus")}
              hint="Optional - more context means better advice"
            />
            <Textarea label="Biggest Challenge" placeholder="What's blocking you most right now?" rows={3} value={form.biggestChallenge} onChange={set("biggestChallenge")} hint="Optional" />
            <Input label="Resources / Constraints" placeholder="e.g. Solo founder, no funding, 3 months runway" value={form.resources} onChange={set("resources")} hint="Optional" />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Target size={15} />} iconPosition="right">
            {status === "loading" ? "Processing decision..." : "Get Founder Decision"}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50">
                  <Target size={22} className="text-violet-700" />
                </div>
                <p className="mt-4 font-bricolage text-base font-bold text-gray-900">Ready for a founder-level decision</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Share your context to get a verdict, confidence score, top priorities, and a focused action plan.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Verdict", "Priorities", "Next steps"].map((label) => (
                    <Badge key={label} variant="violet" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="decision" />
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
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bricolage text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">Founder brief</p>
                      <h3 className="mt-1 font-bricolage text-xl font-bold text-gray-950">{form.idea || "Founder decision"}</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyReport} icon={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}>
                      {copied ? "Copied" : "Copy report"}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-start gap-6">
                    <ScoreRing
                      score={result.confidenceScore}
                      label="Confidence Score"
                      sublabel={result.confidenceScore >= 70 ? "High Conviction" : result.confidenceScore >= 50 ? "Moderate" : "Low Conviction"}
                      size={112}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Target size={14} className="text-violet-700" />
                        <span className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Final Verdict</span>
                      </div>
                      <p className="font-jakarta text-sm leading-relaxed text-gray-650">{result.finalVerdict}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb size={14} className="text-violet-700" />
                    <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-violet-800">Founder Summary</h4>
                  </div>
                  <p className="font-jakarta text-sm leading-relaxed text-gray-650">{result.founderSummary}</p>
                </div>

                {result.top3Priorities.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Top 3 Priorities</h4>
                    </div>
                    <div className="space-y-3">
                      {result.top3Priorities.map((priority) => (
                        <div key={priority.rank} className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white">
                            <span className="font-bricolage text-xs font-bold text-emerald-700">{priority.rank}</span>
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <p className="font-bricolage text-sm font-bold text-gray-950">{priority.priority}</p>
                              <span className="font-jakarta text-xs font-semibold text-emerald-700">{priority.timeframe}</span>
                            </div>
                            <p className="font-jakarta text-xs leading-relaxed text-gray-600">{priority.why}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StrategyCard icon={<TrendingUp size={13} />} title="Fix First" body={result.whatToFixFirst} tone="emerald" />
                  <StrategyCard icon={<AlertTriangle size={13} />} title="Biggest Mistake" body={result.biggestStrategicMistake} tone="rose" />
                </div>

                <StrategyCard icon={<Zap size={13} />} title="Fastest Path to Traction" body={result.fastestPathToTraction} tone="blue" wide />

                {result.whatNotToBuildYet.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <X size={13} className="text-rose-500" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Do Not Build Yet</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.whatNotToBuildYet.map((item, index) => (
                        <Badge key={index} variant="peach" dot>
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.actionableNextSteps.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-teal-600" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Actionable Next Steps</h4>
                    </div>
                    <div className="space-y-2">
                      {result.actionableNextSteps.map((step, index) => (
                        <div key={index} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white">
                            <span className="font-mono text-[9px] font-bold text-teal-700">{index + 1}</span>
                          </span>
                          <p className="font-jakarta text-sm leading-relaxed text-gray-600">{step}</p>
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

function ContextCard({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "violet" | "emerald" | "rose" }) {
  const toneClasses = {
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-600",
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

function StrategyCard({ icon, title, body, tone, wide = false }: { icon: React.ReactNode; title: string; body: string; tone: "emerald" | "rose" | "blue"; wide?: boolean }) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-600",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-2xl border p-5 ${toneClasses[tone]} ${wide ? "" : ""}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide">{title}</h4>
      </div>
      <p className="font-jakarta text-sm leading-relaxed text-gray-650">{body}</p>
    </div>
  );
}
