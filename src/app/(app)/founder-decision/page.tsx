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
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { DecisionEngineOutput } from "@/types";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";
import {
  DECISION_EXPERIMENT_LIMITATION,
  DECISION_LIMITATION,
  STRATEGIC_INTERPRETATION_DISCLAIMER,
  buildDecisionActionHierarchy,
  buildDecisionCopyReport,
  calibrateDecisionText,
  getDecisionContextCompleteness,
} from "@/lib/decision-display";

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
    if (status === "loading") return;
    if (!validate()) return;
    setStatus("loading");
    setCopied(false);

    try {
      const res = await fetch("/api/analyze/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
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

    await navigator.clipboard.writeText(buildDecisionCopyReport(form, result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <EngineHeader
        icon={<Target size={22} />}
        title="Founder Decision Engine"
        description="Turn founder-provided context into a calibrated strategic brief, prioritised experiments, and clear assumptions to test."
        badge="Intelligence Engine"
        badgeVariant="cocoa"
        accentColor="#7c3aed"
      />

      <MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="124, 58, 237" spotlightOpacity={0.07}>
        <ContextCard icon={<Compass size={16} />} title="Strategic interpretation" detail="Generated from supplied context" tone="violet" />
        <ContextCard icon={<ClipboardCheck size={16} />} title="Action hierarchy" detail="One primary test, then two follow-ups" tone="emerald" />
        <ContextCard icon={<ShieldAlert size={16} />} title="Risk framing" detail="Assumptions to investigate" tone="rose" />
      </MagicBentoGrid>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-gray-900">Founder context</h3>
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

        <div className={status === "idle" ? "hidden" : "w-full min-w-0 max-w-full"}>
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
                <p className="mt-4 font-jakarta text-base font-bold text-gray-900">Ready for a founder-level decision</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Share your context to get an AI-assisted interpretation, context completeness, top priorities, and a focused action plan.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Interpretation", "Priorities", "Experiments"].map((label) => (
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
                <div className="space-y-3">
                  <ErrorState message={errorMessage} onRetry={handleSubmit} />
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Edit inputs</Button>
                  </div>
                </div>
              </motion.div>
            )}

            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {(() => {
                  const completeness = getDecisionContextCompleteness(form);
                  const hierarchy = buildDecisionActionHierarchy(result, form);
                  const priorities = result.top3Priorities.slice(0, 3);
                  return (
                    <>
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">Founder brief</p>
                      <h3 className="mt-1 font-jakarta text-xl font-bold text-gray-950">{form.idea || "Founder decision"}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Edit inputs</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSubmit()}>Run again</Button>
                      <ExportPdfButton />
                      <Button variant="outline" size="sm" onClick={copyReport} icon={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}>
                        {copied ? "Copied" : "Copy report"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <p className="font-jakarta text-xs font-bold uppercase tracking-wide text-violet-800">Context completeness</p>
                      <p className="mt-2 font-jakarta text-2xl font-bold text-violet-950">{completeness.label}</p>
                      <p className="mt-2 font-jakarta text-xs leading-relaxed text-violet-900">This measures only supplied information, not viability or probability of success.</p>
                      <div className="mt-3 space-y-2">
                        {[...completeness.suppliedReasons, ...completeness.missingReasons].slice(0, 7).map((reason) => (
                          <p key={reason} className="font-jakarta text-xs leading-relaxed text-violet-900">- {reason}</p>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Target size={14} className="text-violet-700" />
                        <span className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Strategic interpretation</span>
                      </div>
                      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">{STRATEGIC_INTERPRETATION_DISCLAIMER}</p>
                      <p className="font-jakarta text-sm leading-relaxed text-gray-650">{calibrateDecisionText(result.finalVerdict)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardCheck size={14} className="text-slate-700" />
                    <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Basis of this brief</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <BriefBasis title="Founder-provided context" items={["startup idea", "product description", "target audience", "current status", "constraints and goals supplied"]} />
                    <BriefBasis title="Independent evidence" items={["No independent evidence was included in this brief."]} />
                    <BriefBasis title="AI contribution" items={["interpretation", "prioritisation suggestions", "risks to test", "action-plan drafting"]} />
                  </div>
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">This brief is based only on founder-provided context.</p>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb size={14} className="text-violet-700" />
                    <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-violet-800">Founder Summary</h4>
                  </div>
                  <p className="font-jakarta text-sm leading-relaxed text-gray-650">{calibrateDecisionText(result.founderSummary)}</p>
                </div>

                <MagicBentoGrid className="grid grid-cols-1" preset="app" glowColor="16, 185, 129" spotlightOpacity={0.06}>
                  <ActionCard title="Primary action - next 48 hours" action={hierarchy.primary} tone="emerald" />
                </MagicBentoGrid>

                {hierarchy.secondary.length > 0 && (
                  <MagicBentoGrid className="grid grid-cols-1 gap-4 lg:grid-cols-2" preset="app" glowColor="37, 99, 235" spotlightOpacity={0.06}>
                    {hierarchy.secondary.slice(0, 2).map((action, index) => (
                      <ActionCard key={`${action.exactAction}-${index}`} title={`Secondary action - next 14 days ${index + 1}`} action={action} tone="blue" />
                    ))}
                  </MagicBentoGrid>
                )}

                {hierarchy.laterParked.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Later / parked</h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hierarchy.laterParked.map((item, index) => <Badge key={`${item}-${index}`} variant="neutral">{item}</Badge>)}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-amber-900">Limitations</h4>
                  <p className="mt-2 font-jakarta text-sm leading-relaxed text-amber-950">{DECISION_LIMITATION}</p>
                  <p className="mt-2 font-jakarta text-sm leading-relaxed text-amber-950">{DECISION_EXPERIMENT_LIMITATION}</p>
                </div>

                {priorities.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Top 3 Priorities</h4>
                    </div>
                    <div className="space-y-3">
                      {priorities.map((priority) => (
                        <div key={priority.rank} className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white">
                            <span className="font-jakarta text-xs font-bold text-emerald-700">{priority.rank}</span>
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <p className="font-jakarta text-sm font-bold text-gray-950">{priority.priority}</p>
                              <span className="font-jakarta text-xs font-semibold text-emerald-700">{priority.timeframe}</span>
                            </div>
                            <p className="font-jakarta text-xs leading-relaxed text-gray-600">{calibrateDecisionText(priority.why)}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <MiniFact label="Based on" value="Founder-provided context" />
                              <MiniFact label="Assumption tested" value={calibrateDecisionText(priority.priority)} />
                              <MiniFact label="Completion condition" value="Record measurable evidence and the next decision." />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StrategyCard icon={<TrendingUp size={13} />} title="First issue to investigate" body={calibrateDecisionText(result.whatToFixFirst)} tone="emerald" />
                  <StrategyCard icon={<AlertTriangle size={13} />} title="Highest-risk assumption" body={calibrateDecisionText(result.biggestStrategicMistake)} tone="rose" />
                </div>

                <StrategyCard icon={<Zap size={13} />} title="Suggested traction experiment" body={calibrateDecisionText(result.fastestPathToTraction)} tone="blue" wide />

                {result.whatNotToBuildYet.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <X size={13} className="text-rose-500" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Features to postpone until core assumptions are tested</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.whatNotToBuildYet.map((item, index) => (
                        <Badge key={index} variant="peach" dot>
                          {calibrateDecisionText(item)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.actionableNextSteps.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-teal-600" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">AI-assisted recommendations</h4>
                    </div>
                    <div className="space-y-2">
                      {result.actionableNextSteps.slice(0, 6).map((step, index) => (
                        <div key={index} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white">
                            <span className="font-mono text-[9px] font-bold text-teal-700">{index + 1}</span>
                          </span>
                          <p className="font-jakarta text-sm leading-relaxed text-gray-600">{calibrateDecisionText(step)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                    </>
                  );
                })()}
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
    <MagicBentoCard className="flex items-start gap-3 rounded-2xl border border-black/6 bg-white p-4 shadow-sm shadow-gray-200/40">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>{icon}</div>
      <div>
        <p className="font-jakarta text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>
    </MagicBentoCard>
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
        <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide">{title}</h4>
      </div>
      <p className="font-jakarta text-sm leading-relaxed text-gray-650">{body}</p>
    </div>
  );
}

function BriefBasis({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-black/8 bg-[#fffefa] p-4">
      <p className="font-jakarta text-xs font-bold text-gray-900">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="font-jakarta text-xs leading-relaxed text-gray-600">- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ActionCard({ title, action, tone }: { title: string; action: { objective: string; exactAction: string; targetAudience: string; metric: string; completionCondition: string }; tone: "emerald" | "blue" }) {
  const toneClasses = tone === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50";
  return (
    <MagicBentoCard className={`rounded-2xl border p-5 ${toneClasses}`}>
      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-800">{title}</h4>
      <p className="mt-3 font-jakarta text-sm font-bold text-gray-950">{action.objective}</p>
      <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-650">{action.exactAction}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MiniFact label="Target audience" value={action.targetAudience} />
        <MiniFact label="Metric" value={action.metric} />
        <MiniFact label="Completion condition" value={action.completionCondition} />
      </div>
      <p className="mt-3 font-jakarta text-[11px] font-semibold text-gray-500">AI-assisted recommendation</p>
    </MagicBentoCard>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/8 bg-white/70 p-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <p className="mt-1 break-words font-jakarta text-xs leading-relaxed text-gray-700">{value}</p>
    </div>
  );
}
