"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Flag,
  Megaphone,
  MessageSquare,
  Rocket,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { GrowthChannel, GrowthEngineOutput } from "@/types";
import { cn } from "@/lib/utils";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";

const budgetOptions = [
  { value: "", label: "Select budget range" },
  { value: "bootstrap", label: "Bootstrapped / $0" },
  { value: "under-1k", label: "Under $1,000/mo" },
  { value: "1k-10k", label: "$1,000-$10,000/mo" },
  { value: "10k-50k", label: "$10,000-$50,000/mo" },
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

const effortColor: Record<string, string> = { low: "#059669", medium: "#d97706", high: "#e11d48" };
const impactColor: Record<string, string> = { low: "#64748b", medium: "#d97706", high: "#059669" };

interface FormState {
  idea: string;
  description: string;
  targetAudience: string;
  currentChannels: string;
  budget: string;
  stage: string;
}

const defaultForm: FormState = {
  idea: "",
  description: "",
  targetAudience: "",
  currentChannels: "",
  budget: "",
  stage: "",
};

export default function GrowthEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<GrowthEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadFounderProfile() {
      try {
        const res = await fetch("/api/founder-profile", {
          headers: await getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok || !data.profile) return;

        setForm((prev) => ({
          ...prev,
          idea: prev.idea || data.profile.startup_idea || "",
          description: prev.description || data.profile.product_summary || "",
          targetAudience: prev.targetAudience || data.profile.target_audience || "",
          stage: prev.stage || data.profile.founder_stage || "",
        }));
      } catch {
        // best-effort personalization
      }
    }

    loadFounderProfile();
  }, []);

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
      const res = await fetch("/api/analyze/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Growth analysis failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("growth");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Growth analysis failed");
      setStatus("error");
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const copyReport = async () => {
    if (!result) return;

    const report = [
      "StartupX AI - Growth Strategy Report",
      "",
      `Idea: ${form.idea}`,
      `Audience: ${form.targetAudience}`,
      form.stage ? `Stage: ${form.stage}` : "",
      form.budget ? `Budget: ${form.budget}` : "",
      "",
      "First 10 Customers Plan",
      ...result.first10CustomersPlan.map((step) => `${step.step}. ${step.action} (${step.timeline}) - ${step.expectedOutcome}`),
      "",
      "Channel Stack",
      ...result.channelSuggestions.map((channel) => `- ${channel.channel}: ${channel.description}\n  Effort: ${channel.effort}, Impact: ${channel.impact}\n  Tactics: ${channel.tactics.join(", ")}`),
      "",
      "Outreach Direction",
      `WhatsApp: ${result.outreachDirection?.whatsapp || ""}`,
      `LinkedIn: ${result.outreachDirection?.linkedin || ""}`,
      `Email: ${result.outreachDirection?.email || ""}`,
      "",
      "Content Hooks",
      ...result.contentHooks.map((hook) => `- ${hook}`),
      "",
      "Campaign Suggestions",
      ...result.campaignSuggestions.map((campaign) => `- ${campaign}`),
      "",
      "Launch Steps",
      ...result.launchSteps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "Audience Segments",
      ...result.audienceSegments.map((segment) => `- ${segment}`),
      "",
      "Customer Acquisition Priorities",
      ...result.customerAcquisitionPriorities.map((priority) => `- ${priority}`),
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
        icon={<TrendingUp size={22} />}
        title="Growth Engine"
        description="Build a stage-specific path to your first customers with channels, outreach angles, campaigns, and launch steps."
        badge="Intelligence Engine"
        badgeVariant="midnight"
        accentColor="#2563eb"
      />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ContextCard icon={<Target size={16} />} title="First customers" detail="A practical first-10 plan" tone="blue" />
        <ContextCard icon={<Megaphone size={16} />} title="Channel stack" detail="Effort and impact ranked" tone="amber" />
        <ContextCard icon={<Rocket size={16} />} title="Launch motion" detail="Hooks, campaigns, outreach" tone="teal" />
      </div>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bricolage text-base font-bold text-gray-900">Growth context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Anchor the plan in your audience, stage, and current channels.</p>
              </div>
              <Badge variant="midnight" size="sm">
                3 required
              </Badge>
            </div>

            <Input label="Startup Idea" placeholder="What do you build?" value={form.idea} onChange={set("idea")} error={errors.idea} required />
            <Textarea
              label="Product Description"
              placeholder="What does it do? What pain does it solve?"
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
              placeholder="Who needs this most? Be specific."
              rows={3}
              value={form.targetAudience}
              onChange={set("targetAudience")}
              error={errors.targetAudience}
              required
            />
            <Select label="Stage" options={stageOptions} value={form.stage} onChange={set("stage")} placeholder="Select stage" />
            <Select label="Monthly Budget" options={budgetOptions} value={form.budget} onChange={set("budget")} placeholder="Select budget range" />
            <Input label="Current Channels" placeholder="e.g. LinkedIn, cold email, referrals" value={form.currentChannels} onChange={set("currentChannels")} hint="Optional - what you're already trying" />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<TrendingUp size={15} />} iconPosition="right">
            {status === "loading" ? "Building growth plan..." : "Run Growth Analysis"}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50">
                  <TrendingUp size={22} className="text-blue-600" />
                </div>
                <p className="mt-4 font-bricolage text-base font-bold text-gray-900">Ready to build the traction plan</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Enter your startup details to get channels, content hooks, outreach direction, campaign ideas, and launch steps.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Channels", "Outreach", "Launch"].map((label) => (
                    <Badge key={label} variant="midnight" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="growth" />
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
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bricolage text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Growth report</p>
                      <h3 className="mt-1 font-bricolage text-xl font-bold text-gray-950">{form.idea || "Growth strategy"}</h3>
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
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MetricTile label="Channels" value={result.channelSuggestions.length} />
                    <MetricTile label="Launch steps" value={result.launchSteps.length} />
                    <MetricTile label="Audience segments" value={result.audienceSegments.length} />
                  </div>
                </div>

                {result.first10CustomersPlan.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <Target size={15} className="text-blue-600" />
                      <h3 className="font-bricolage text-sm font-bold text-gray-900">First 10 Customers Plan</h3>
                    </div>
                    <div className="space-y-3">
                      {result.first10CustomersPlan.map((step) => (
                        <div key={step.step} className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white">
                            <span className="font-bricolage text-xs font-bold text-blue-700">{String(step.step).padStart(2, "0")}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bricolage text-sm font-semibold text-gray-950">{step.action}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-jakarta text-xs text-gray-500">{step.timeline}</span>
                              <span className="font-jakarta text-xs font-semibold text-blue-700">{step.expectedOutcome}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.channelSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <Zap size={14} className="text-blue-600" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Channel Stack</h4>
                    </div>
                    <div className="space-y-3">
                      {result.channelSuggestions.map((channel) => (
                        <ChannelCard key={channel.channel} channel={channel} />
                      ))}
                    </div>
                  </div>
                )}

                {result.outreachDirection && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <MessageSquare size={14} className="text-emerald-600" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Outreach Direction</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { label: "WhatsApp", value: result.outreachDirection.whatsapp, variant: "forest" as const },
                        { label: "LinkedIn", value: result.outreachDirection.linkedin, variant: "midnight" as const },
                        { label: "Email", value: result.outreachDirection.email, variant: "cocoa" as const },
                      ].map((channel) => (
                        <div key={channel.label} className="rounded-xl border border-black/6 bg-gray-50 p-3">
                          <Badge variant={channel.variant} size="sm">
                            {channel.label}
                          </Badge>
                          <p className="mt-2 font-jakarta text-xs leading-relaxed text-gray-600">{channel.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <BulletPanel icon={<Zap size={13} />} title="Content Hooks" items={result.contentHooks} tone="amber" />
                  <BadgePanel icon={<Target size={13} />} title="CAC Priorities" items={result.customerAcquisitionPriorities} variant="sage" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <BulletPanel icon={<Flag size={13} />} title="Campaign Suggestions" items={result.campaignSuggestions} tone="blue" />
                  <LaunchPanel items={result.launchSteps} />
                </div>

                {result.audienceSegments.length > 0 && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <Users size={14} className="text-blue-600" />
                      <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Audience Segments</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.audienceSegments.map((segment, index) => (
                        <Badge key={index} variant="midnight" dot>
                          {segment}
                        </Badge>
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

function ContextCard({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "blue" | "amber" | "teal" }) {
  const toneClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
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

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="font-bricolage text-2xl font-bold text-blue-700">{value}</p>
      <p className="font-jakarta text-xs text-gray-500">{label}</p>
    </div>
  );
}

function BulletPanel({ icon, title, items, tone }: { icon: React.ReactNode; title: string; items: string[]; tone: "amber" | "blue" }) {
  const iconClass = tone === "amber" ? "text-amber-700" : "text-blue-700";
  const itemClass = tone === "amber" ? "border-amber-100 bg-amber-50/60" : "border-blue-100 bg-blue-50/60";

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className={iconClass}>{icon}</span>
        <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">{title}</h4>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className={`flex items-start gap-2.5 rounded-xl border p-3 ${itemClass}`}>
            <ArrowRight size={13} className={`mt-0.5 flex-shrink-0 ${iconClass}`} />
            <p className="font-jakarta text-xs leading-relaxed text-gray-600">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgePanel({ icon, title, items, variant }: { icon: React.ReactNode; title: string; items: string[]; variant: "sage" }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-emerald-600">{icon}</span>
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

function LaunchPanel({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 size={13} className="text-teal-600" />
        <h4 className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-700">Launch Steps</h4>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-teal-200 bg-white">
              <span className="font-mono text-[9px] font-bold text-teal-700">{index + 1}</span>
            </span>
            <p className="font-jakarta text-sm leading-relaxed text-gray-600">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: GrowthChannel }) {
  return (
    <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-bricolage text-sm font-bold text-gray-950">{channel.channel}</p>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill label="Effort" value={channel.effort} color={effortColor[channel.effort]} />
          <StatusPill label="Impact" value={channel.impact} color={impactColor[channel.impact]} />
        </div>
      </div>
      <p className="mb-3 font-jakarta text-xs leading-relaxed text-gray-500">{channel.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {channel.tactics.map((tactic, index) => (
          <span key={index} className={cn("rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bricolage text-[10px] font-medium text-blue-700")}>
            {tactic}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="rounded-full border px-1.5 py-0.5 font-bricolage text-[9px] font-bold capitalize" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
      {label}: {value}
    </span>
  );
}
