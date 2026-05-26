"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  AlertTriangle,
  Eye,
  Target,
  Compass,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Copy,
  CheckCircle2,
  RefreshCw,
  Rocket,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea, Select } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { IdeaEngineOutput } from "@/types";
import { getScoreColor } from "@/lib/utils";
import { logUsageClient } from "@/lib/usage-client";

const industryOptions = [
  { value: "", label: "Select an industry" },
  { value: "saas", label: "SaaS / Software" },
  { value: "marketplace", label: "Marketplace" },
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "ai-ml", label: "AI / Machine Learning" },
  { value: "developer-tools", label: "Developer Tools" },
  { value: "consumer", label: "Consumer App" },
  { value: "b2b", label: "B2B Services" },
  { value: "media", label: "Media / Content" },
  { value: "other", label: "Other" },
];

interface FormState {
  idea: string;
  description: string;
  targetAudience: string;
  industry: string;
  region: string;
  productUrl: string;
}

interface ImprovedIdeaState {
  improvedIdea: string;
  newPositioning: string;
  monetizationTwist: string;
  defensibility: string;
}

const defaultForm: FormState = {
  idea: "",
  description: "",
  targetAudience: "",
  industry: "",
  region: "",
  productUrl: "",
};

export default function IdeaEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<IdeaEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [improving, setImproving] = useState(false);
  const [improvedIdea, setImprovedIdea] = useState<ImprovedIdeaState | null>(null);
  const [copied, setCopied] = useState(false);

  const validate = (): boolean => {
    const e: Partial<FormState> = {};

    if (!form.idea.trim()) {
      e.idea = "Startup idea is required";
    } else if (form.idea.trim().length < 10) {
      e.idea = "Please describe your idea in more detail";
    }

    if (!form.description.trim()) {
      e.description = "Product description is required";
    } else if (form.description.trim().length < 30) {
      e.description = "Description must be at least 30 characters";
    }

    if (!form.targetAudience.trim()) {
      e.targetAudience = "Target audience is required";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setStatus("loading");
    setResult(null);
    setImprovedIdea(null);
    setErrorMessage("");

    try {
      const res = await fetch("/api/analyze/idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": `session_${Date.now()}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data.data);
      setStatus("success");
      logUsageClient("idea");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setStatus("error");
    }
  };

  const handleImproveIdea = async () => {
    if (!result) return;

    setImproving(true);
    setImprovedIdea(null);
    setErrorMessage("");

    try {
      const res = await fetch("/api/improve-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: form.idea,
          description: form.description,
          targetAudience: form.targetAudience,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to improve idea");
      }

      setImprovedIdea(data.data as ImprovedIdeaState);
      logUsageClient("improve-idea");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to improve idea");
      setStatus("error");
    } finally {
      setImproving(false);
    }
  };

  const setField =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const verdict =
    result && result.marketDemandScore > 70 && result.ideaClarityScore > 60
      ? "Strong opportunity. Worth building with focused differentiation."
      : result && result.marketDemandScore > 50
      ? "Moderate potential. Reposition before serious execution."
      : result
      ? "Weak signal. Pivot or narrow the market before building."
      : "";

  const copyReport = async () => {
    if (!result) return;

    const report = [
      `StartupX AI - Idea & Market Report`,
      ``,
      `Idea: ${form.idea}`,
      `Market Demand: ${result.marketDemandScore}/100`,
      `Idea Clarity: ${result.ideaClarityScore}/100`,
      ``,
      `Executive Summary`,
      result.executiveSummary,
      ``,
      `Verdict`,
      result.overallVerdict,
      ``,
      `Category Positioning`,
      result.categoryPositioning,
      ``,
      `Risk Factors`,
      ...result.riskFactors.map((item) => `- ${item}`),
      ``,
      `Hidden Opportunities`,
      ...result.hiddenOpportunities.map((item) => `- ${item}`),
      ``,
      `Ideal ICP`,
      ...result.idealICP.map((item) => `- ${item}`),
    ].join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader
        icon={<Lightbulb size={22} />}
        title="Idea & Market Engine"
        description="Turn a rough startup idea into a scored founder brief with market demand, clarity, risk, positioning, ICP, and next-step signals."
        badge="Intelligence Engine"
        badgeVariant="sage"
        accentColor="#10b981"
      />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Compass, label: "Market read", text: "Demand, ICP, and category signals" },
          { icon: ShieldAlert, label: "Risk map", text: "Failure points before you build" },
          { icon: Rocket, label: "Next moves", text: "Positioning and execution direction" },
        ].map(({ icon: Icon, label, text }) => (
          <div key={label} className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm">
            <Icon size={16} className="text-emerald-600 mb-2" />
            <p className="font-bricolage text-xs font-bold text-gray-900">{label}</p>
            <p className="font-jakarta text-xs text-gray-400 mt-1">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-white p-6 space-y-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bricolage text-sm font-bold text-gray-900">Startup context</h3>
                <p className="font-jakarta text-xs text-gray-400 mt-1">
                  Better input creates a sharper market report.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bricolage text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                3 required
              </span>
            </div>

            <Input
              label="Startup Idea"
              placeholder="e.g. AI-powered hiring platform for remote teams"
              value={form.idea}
              onChange={setField("idea")}
              error={errors.idea}
              required
              hint="One clear sentence describing your idea"
            />

            <Textarea
              label="Product Description"
              placeholder="What does it do? How does it work? What problem does it solve?"
              rows={4}
              value={form.description}
              onChange={setField("description")}
              error={errors.description}
              required
              charCount
              maxChars={2000}
            />

            <Textarea
              label="Target Audience"
              placeholder="Who is your ideal customer? Be specific - industry, role, company size, pain point."
              rows={3}
              value={form.targetAudience}
              onChange={setField("targetAudience")}
              error={errors.targetAudience}
              required
            />

            <Select
              label="Industry"
              options={industryOptions}
              value={form.industry}
              onChange={setField("industry")}
              placeholder="Select an industry"
            />

            <Input
              label="Region / Market"
              placeholder="e.g. India, Southeast Asia, US SMBs"
              value={form.region}
              onChange={setField("region")}
              hint="Optional - helps with market-specific analysis"
            />

            <Input
              label="Product URL"
              type="url"
              placeholder="https://yourstartup.com"
              value={form.productUrl}
              onChange={setField("productUrl")}
              hint="Optional - if you already have a site"
            />
          </div>

          <Button
            size="lg"
            fullWidth
            onClick={handleSubmit}
            className="bg-gradient-to-r from-sage-600 to-emerald-600 hover:from-sage-500 hover:to-emerald-500"
            loading={status === "loading"}
            icon={<ArrowRight size={16} />}
            iconPosition="right"
          >
            {status === "loading" ? "Analyzing..." : "Run Market Analysis"}
          </Button>

          {status === "success" && result && (
            <p className="font-jakarta text-xs text-gray-400 text-center">
              Analysis complete · Report generated on the right
            </p>
          )}
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Lightbulb size={20} className="text-emerald-700" />
                </div>
                <div>
                  <p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Ready to analyze</p>
                  <p className="font-jakarta text-sm text-gray-400 max-w-xs">
                    Fill in your startup details on the left and click Run Market Analysis.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-lg mt-2">
                  {["Market demand", "Risk factors", "Ideal ICP"].map((item) => (
                    <div key={item} className="rounded-xl border border-black/6 bg-white px-3 py-2">
                      <p className="font-jakarta text-xs text-gray-500">{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AnalysisLoading engine="idea" />
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ErrorState message={errorMessage} onRetry={() => setStatus("idle")} />
              </motion.div>
            )}

            {status === "success" && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="font-bricolage text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
                        Founder report
                      </p>
                      <h3 className="font-bricolage text-xl font-bold text-gray-900">
                        {form.idea || "Idea analysis"}
                      </h3>
                    </div>
                    <button
                      onClick={copyReport}
                      className="h-10 px-4 rounded-xl border border-black/8 bg-gray-50 font-bricolage text-xs font-bold text-gray-700 hover:bg-white transition-colors flex items-center gap-2 w-fit"
                    >
                      {copied ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy report"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-5 mb-6">
                    <div className="rounded-2xl border border-black/6 bg-gray-50 p-5 flex items-center justify-center">
                      <ScoreRing
                        score={result.marketDemandScore}
                        label="Market Demand"
                        sublabel={getScoreColor(result.marketDemandScore).label}
                        size={120}
                      />
                    </div>
                    <div className="rounded-2xl border border-black/6 bg-gray-50 p-5 flex items-center justify-center">
                      <ScoreRing
                        score={result.ideaClarityScore}
                        label="Idea Clarity"
                        sublabel={getScoreColor(result.ideaClarityScore).label}
                        size={120}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bricolage text-sm font-bold text-emerald-800 mb-1">AI verdict</p>
                        <p className="font-jakarta text-sm text-emerald-700 leading-relaxed">{verdict}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={15} className="text-gray-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Executive Summary</h3>
                  </div>

                  <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
                    {result.executiveSummary}
                  </p>

                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="font-jakarta text-sm text-emerald-700 leading-relaxed italic">
                      {result.overallVerdict}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Button
                      size="lg"
                      fullWidth
                      onClick={handleImproveIdea}
                      className="bg-gradient-to-r from-cocoa-600 to-orange-500 hover:from-cocoa-500 hover:to-orange-400"
                      loading={improving}
                      icon={improving ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                      iconPosition="right"
                    >
                      {improving ? "Refining your idea..." : "Refine positioning with AI"}
                    </Button>
                  </div>

                  {improvedIdea && (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-amber-700" />
                        <h3 className="font-bricolage text-sm font-bold text-gray-800">
                          Improved Idea
                        </h3>
                      </div>

                      <div>
                        <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                          Better Version
                        </p>
                        <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
                          {improvedIdea.improvedIdea}
                        </p>
                      </div>

                      <div>
                        <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                          New Positioning
                        </p>
                        <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
                          {improvedIdea.newPositioning}
                        </p>
                      </div>

                      <div>
                        <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                          Monetization Twist
                        </p>
                        <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
                          {improvedIdea.monetizationTwist}
                        </p>
                      </div>

                      <div>
                        <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                          Defensibility
                        </p>
                        <p className="font-jakarta text-sm text-gray-600 leading-relaxed">
                          {improvedIdea.defensibility}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Compass size={14} className="text-emerald-600" />
                    <span className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Category Positioning
                    </span>
                  </div>
                  <p className="font-jakarta text-sm text-gray-600">{result.categoryPositioning}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ResultList
                    icon={<AlertTriangle size={14} className="text-rose-500" />}
                    title="Risk Factors"
                    items={result.riskFactors}
                    chipVariant="peach"
                  />
                  <ResultList
                    icon={<TrendingUp size={14} className="text-emerald-600" />}
                    title="Hidden Opportunities"
                    items={result.hiddenOpportunities}
                    chipVariant="sage"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ResultList
                    icon={<Eye size={14} className="text-blue-600" />}
                    title="Assumptions Detected"
                    items={result.assumptionsDetected}
                    chipVariant="midnight"
                  />
                  <ResultList
                    icon={<ShieldAlert size={14} className="text-rose-500" />}
                    title="Why It May Fail"
                    items={result.whyItMayFail}
                    chipVariant="peach"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ResultList
                    icon={<Sparkles size={14} className="text-amber-700" />}
                    title="Differentiation Angles"
                    items={result.differentiationSuggestions}
                    chipVariant="cocoa"
                  />
                  <ResultList
                    icon={<Target size={14} className="text-teal-600" />}
                    title="Ideal ICP"
                    items={result.idealICP}
                    chipVariant="forest"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ResultList({
  icon,
  title,
  items,
  chipVariant,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  chipVariant: "sage" | "cocoa" | "forest" | "peach" | "midnight" | "neutral" | "blush";
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">
          {title}
        </h4>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Badge
              variant={chipVariant}
              size="md"
              className="w-full justify-start text-left whitespace-normal h-auto py-1.5"
            >
              {item}
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
