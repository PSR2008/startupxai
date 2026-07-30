"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Copy,
  Eye,
  Frown,
  MousePointerClick,
  ShieldCheck,
  Zap,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { PsychologyEngineOutput } from "@/types";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";

interface FormState {
  idea: string;
  description: string;
  targetAudience: string;
  productUrl: string;
  currentCopy: string;
}

const defaultForm: FormState = {
  idea: "",
  description: "",
  targetAudience: "",
  productUrl: "",
  currentCopy: "",
};

export default function PsychologyPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<PsychologyEngineOutput | null>(null);
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
      const res = await fetch("/api/analyze/psychology", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Psychology analysis failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("psychology");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Psychology analysis failed");
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
      "StartupX AI - User Psychology Audit",
      "",
      `Idea: ${form.idea}`,
      `Audience: ${form.targetAudience}`,
      form.productUrl ? `Product URL: ${form.productUrl}` : "",
      "",
      `Trust Score: ${result.trustScore}/100`,
      "",
      "Brutal Roast",
      result.brutalRoast,
      "",
      "Credibility Gaps",
      ...result.credibilityGaps.map((gap) => `- ${gap}`),
      "",
      "Friction Points",
      ...result.frictionPoints.map((point) => `- ${point}`),
      "",
      "First Impression Issues",
      ...result.firstImpressionIssues.map((issue) => `- ${issue}`),
      "",
      "Copy / Messaging Issues",
      ...result.confusingCopyIssues.map((issue) => `- ${issue}`),
      "",
      "Emotional Objections",
      ...result.emotionalObjections.map((objection) => `- ${objection}`),
      "",
      "UX Recommendations",
      ...result.uxRecommendations.map((recommendation, index) => `${index + 1}. ${recommendation}`),
      "",
      "Trust Building Actions",
      ...result.trustBuildingActions.map((action, index) => `${index + 1}. ${action}`),
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
        icon={<Brain size={22} />}
        title="User Psychology Engine"
        description="Audit trust, UX friction, emotional objections, and messaging clarity so users feel safer saying yes."
        badge="Intelligence Engine"
        badgeVariant="peach"
        accentColor="#f43f5e"
      />

      <MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="244, 63, 94" spotlightOpacity={0.07}>
        <ContextCard icon={<ShieldCheck size={16} />} title="Trust signals" detail="What makes users believe" tone="rose" />
        <ContextCard icon={<MousePointerClick size={16} />} title="UX friction" detail="What blocks action" tone="blue" />
        <ContextCard icon={<Copy size={16} />} title="Copy clarity" detail="What makes the value click" tone="pink" />
      </MagicBentoGrid>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bricolage text-base font-bold text-gray-900">Psychology context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Share the product, audience, and current message users see.</p>
              </div>
              <Badge variant="peach" size="sm">
                3 required
              </Badge>
            </div>

            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea
              label="Product Description"
              placeholder="Your product, value prop, key features."
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
              placeholder="Who is your target user? What do they fear, want, or compare?"
              rows={3}
              value={form.targetAudience}
              onChange={set("targetAudience")}
              error={errors.targetAudience}
              required
            />
            <Input label="Product URL" type="url" placeholder="https://yourstartup.com" value={form.productUrl} onChange={set("productUrl")} hint="Optional - improves accuracy" />
            <Textarea
              label="Current Homepage Copy"
              placeholder="Paste your hero heading, subheading, or key messaging here..."
              rows={4}
              value={form.currentCopy}
              onChange={set("currentCopy")}
              hint="Optional - paste your headline/subheadline"
              charCount
              maxChars={2000}
            />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Brain size={15} />} iconPosition="right">
            {status === "loading" ? "Profiling users..." : "Run Psychology Analysis"}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
                  <Brain size={22} className="text-rose-500" />
                </div>
                <p className="mt-4 font-bricolage text-base font-bold text-gray-900">Ready for the trust audit</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Add your product context to uncover why users hesitate, what feels confusing, and what would make them trust you.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Trust", "Friction", "Copy"].map((label) => (
                    <Badge key={label} variant="peach" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="psychology" />
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
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bricolage text-[11px] font-bold uppercase tracking-[0.18em] text-rose-600">Psychology audit</p>
                      <h3 className="mt-1 font-bricolage text-xl font-bold text-gray-950">{form.idea || "Trust and UX audit"}</h3>
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

                  <div className="flex flex-wrap items-center gap-8">
                    <ScoreRing score={result.trustScore} label="Trust Score" sublabel={result.trustScore >= 70 ? "Trustworthy" : result.trustScore >= 50 ? "Needs Work" : "Low Trust"} size={112} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Frown size={14} className="text-rose-500" />
                        <span className="font-bricolage text-xs font-bold uppercase tracking-wide text-rose-600">Brutal Roast</span>
                      </div>
                      <p className="font-jakarta text-sm italic leading-relaxed text-gray-650">&ldquo;{result.brutalRoast}&rdquo;</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <BadgePanel icon={<AlertTriangle size={13} />} title="Credibility Gaps" items={result.credibilityGaps} variant="peach" />
                  <BadgePanel icon={<Eye size={13} />} title="Friction Points" items={result.frictionPoints} variant="midnight" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <BadgePanel icon={<Eye size={13} />} title="First Impression Issues" items={result.firstImpressionIssues} variant="cocoa" />
                  <BadgePanel icon={<Brain size={13} />} title="Copy / Messaging Issues" items={result.confusingCopyIssues} variant="blush" />
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                  <div className="mb-3 flex items-center gap-2">
                    <Frown size={13} className="text-rose-500" />
                    <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Emotional Objections Users Have</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.emotionalObjections.map((objection, index) => (
                      <Badge key={index} variant="peach" dot>
                        {objection}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ActionPanel icon={<Zap size={13} />} title="UX Recommendations" items={result.uxRecommendations} tone="emerald" />
                  <ActionPanel icon={<ShieldCheck size={13} />} title="Trust Building Actions" items={result.trustBuildingActions} tone="teal" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ContextCard({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "rose" | "blue" | "pink" }) {
  const toneClasses = {
    rose: "border-rose-200 bg-rose-50 text-rose-600",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    pink: "border-pink-200 bg-pink-50 text-pink-600",
  };

  return (
    <MagicBentoCard className="flex items-start gap-3 rounded-2xl border border-black/6 bg-white p-4 shadow-sm shadow-gray-200/40">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>{icon}</div>
      <div>
        <p className="font-bricolage text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>
    </MagicBentoCard>
  );
}

function BadgePanel({
  icon,
  title,
  items,
  variant,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  variant: "peach" | "midnight" | "cocoa" | "blush";
}) {
  const iconClass = {
    peach: "text-rose-500",
    midnight: "text-blue-600",
    cocoa: "text-amber-700",
    blush: "text-pink-600",
  }[variant];

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className={iconClass}>{icon}</span>
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

function ActionPanel({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: "emerald" | "teal" }) {
  const toneClasses = {
    emerald: {
      icon: "text-emerald-600",
      item: "border-emerald-100 bg-emerald-50/60",
      marker: "text-emerald-700",
    },
    teal: {
      icon: "text-teal-600",
      item: "border-teal-100 bg-teal-50/60",
      marker: "text-teal-700",
    },
  }[tone];

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className={toneClasses.icon}>{icon}</span>
        <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h4>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className={`flex items-start gap-3 rounded-xl border p-3 ${toneClasses.item}`}>
            <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-current bg-white font-mono text-[9px] font-bold ${toneClasses.marker}`}>
              {index + 1}
            </span>
            <p className="font-jakarta text-sm leading-relaxed text-gray-600">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
