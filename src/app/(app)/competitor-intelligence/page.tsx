"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Radar,
  ShieldAlert,
  Swords,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { AnalysisLoading } from "@/components/ui/States";
import type { Competitor, CompetitorEngineOutput } from "@/types";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";
import { GENERIC_ANALYSIS_ERROR, readSafeApiResponse } from "@/lib/safe-api-response";

interface FormState {
  idea: string;
  competitorNames: string;
  industry: string;
  startupUrl: string;
}

const defaultForm: FormState = {
  idea: "",
  competitorNames: "",
  industry: "",
  startupUrl: "",
};

export default function CompetitorPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<CompetitorEngineOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const activeRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRequestRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.idea.trim()) e.idea = "Startup idea is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (options: { retry?: boolean } = {}) => {
    if (status === "loading") return;
    if (options.retry && retryCount >= 1) return;
    if (!validate()) return;
    if (options.retry) setRetryCount((count) => count + 1);
    if (!options.retry) setRetryCount(0);
    setStatus("loading");
    setCopied(false);
    setErrorMessage("");
    setErrorDetail("");
    setErrorCode("");
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      const res = await fetch("/api/analyze/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(options.retry ? { "X-StartupX-Retry": "1" } : {}), ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
        signal: controller.signal,
      });
      if (requestId !== activeRequestRef.current) return;
      const data = await readSafeApiResponse<CompetitorEngineOutput>(res);
      if (requestId !== activeRequestRef.current) return;
      if (!data.ok) {
        setErrorCode(data.code);
        setErrorMessage(data.message || GENERIC_ANALYSIS_ERROR);
        setErrorDetail(
          data.code === "INVALID_PROVIDER_RESPONSE"
            ? "The analysis provider returned an unexpected response. Your input was not lost. Please try again."
          : data.code === "PROVIDER_TIMEOUT"
            ? "The analysis provider did not respond within the available time. Your input was not lost."
            : data.code === "PROVIDER_RATE_LIMITED"
            ? "The analysis provider is temporarily busy. Please try again shortly."
            : data.code === "PROVIDER_AUTH_ERROR"
            ? "The analysis service is temporarily unavailable."
            : data.code === "PLAN_LIMIT_REACHED" || data.code === "RATE_LIMITED"
            ? "Usage limit reached."
            : data.code === "AUTHENTICATION_REQUIRED"
            ? "Please sign in again."
            : data.detail || "Your input was not lost. Please try again."
        );
        setStatus("error");
        return;
      }
      setResult(data.data);
      setStatus("success");
      logUsageClient("competitor");
    } catch (err) {
      if (requestId !== activeRequestRef.current) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMessage(GENERIC_ANALYSIS_ERROR);
      setErrorDetail("Your input was not lost. Please try again.");
      setStatus("error");
    } finally {
      if (requestId === activeRequestRef.current) abortControllerRef.current = null;
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
    if (status === "error") setStatus("idle");
    setRetryCount(0);
  };

  const copyReport = async () => {
    if (!result) return;

    const competitorLines = (label: string, competitors: Competitor[]) =>
      competitors.length
        ? [
            label,
            ...competitors.map(
              (competitor) =>
                `- ${competitor.name}: ${competitor.description}\n  Strengths: ${competitor.strengths.join(", ")}\n  Weaknesses: ${competitor.weaknesses.join(", ")}`,
            ),
          ].join("\n")
        : `${label}\n- None identified`;

    const report = [
      "StartupX AI - Competitor Intelligence Report",
      "",
      `Idea: ${form.idea}`,
      form.industry ? `Industry: ${form.industry}` : "",
      form.startupUrl ? `Product URL: ${form.startupUrl}` : "",
      "",
      "Competitive Landscape Summary",
      result.comparisonSummary,
      "",
      "Strategic Advantage",
      result.strategicAdvantage,
      "",
      competitorLines("Direct Competitors", result.directCompetitors),
      "",
      competitorLines("Indirect Competitors", result.indirectCompetitors),
      "",
      "Positioning Gaps",
      ...result.positioningGaps.map((gap) => `- ${gap}`),
      "",
      "White Space Opportunities",
      ...result.whiteSpaceOpportunities.map((opportunity) => `- ${opportunity}`),
      "",
      "How to Beat Them",
      ...result.howToBeatThem.map((strategy, index) => `${index + 1}. ${strategy}`),
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
        icon={<Swords size={22} />}
        title="Competitor Intelligence Engine"
        description="Map direct and indirect competitors, expose positioning gaps, and turn the market landscape into a practical battle plan."
        badge="Intelligence Engine"
        badgeVariant="cocoa"
        accentColor="#f59e0b"
      />

      <MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="245, 158, 11" spotlightOpacity={0.07}>
        <ContextCard icon={<Radar size={16} />} title="Landscape map" detail="Direct and indirect competitor view" tone="amber" />
        <ContextCard icon={<Compass size={16} />} title="Positioning gaps" detail="Where the market is under-served" tone="blue" />
        <ContextCard icon={<Swords size={16} />} title="Battle plan" detail="How to compete with focus" tone="teal" />
      </MagicBentoGrid>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-gray-900">Competitive context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Give the engine a clear view of what you are building.</p>
              </div>
              <Badge variant="peach" size="sm">
                1 required
              </Badge>
            </div>

            <Input
              label="Your Startup Idea"
              placeholder="e.g. B2B SaaS for restaurant inventory management"
              value={form.idea}
              onChange={set("idea")}
              error={errors.idea}
              required
              hint="What you're building"
            />
            <Textarea
              label="Known Competitors"
              placeholder="e.g. MarketMan, BlueCart, Lightspeed, Toast POS"
              rows={3}
              value={form.competitorNames}
              onChange={set("competitorNames")}
              hint="Optional - separate with commas"
            />
            <Input
              label="Industry"
              placeholder="e.g. Restaurant Tech, Food & Beverage SaaS"
              value={form.industry}
              onChange={set("industry")}
              hint="Optional but improves accuracy"
            />
            <Input
              label="Your Product URL"
              type="url"
              placeholder="https://yourstartup.com"
              value={form.startupUrl}
              onChange={set("startupUrl")}
              hint="Optional"
            />
          </div>

          <Button size="lg" fullWidth onClick={() => handleSubmit()} loading={status === "loading"} disabled={status === "loading"} icon={<Swords size={15} />} iconPosition="right">
            {status === "loading" ? "Mapping competitors..." : "Run Competitor Analysis"}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
                  <Swords size={22} className="text-amber-600" />
                </div>
                <p className="mt-4 font-jakarta text-base font-bold text-gray-900">Ready to map the market</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Enter your idea to generate a competitor map, positioning gaps, white-space opportunities, and a focused action plan.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Direct rivals", "White space", "Beat strategy"].map((label) => (
                    <Badge key={label} variant="cocoa" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="competitor" />
              </motion.div>
            )}

            {status === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <CompetitorErrorState
                  message={errorMessage}
                  detail={errorDetail}
                  code={errorCode}
                  retryDisabled={retryCount >= 1}
                  onRetry={() => handleSubmit({ retry: true })}
                  onEdit={() => setStatus("idle")}
                />
              </motion.div>
            )}

            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Competitive report</p>
                      <h3 className="mt-1 font-jakarta text-xl font-bold text-gray-950">{form.idea || "Competitor map"}</h3>
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

                  <div className="mt-5 space-y-4">
                    <div>
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-500">Landscape Summary</h4>
                      <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-650">{result.comparisonSummary}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-jakarta text-xs font-bold text-amber-800">Your Strategic Advantage</p>
                      <p className="mt-1.5 font-jakarta text-sm leading-relaxed text-gray-650">{result.strategicAdvantage}</p>
                    </div>
                  </div>
                </div>

                {result.directCompetitors.length > 0 && (
                  <section className="space-y-3">
                    <h4 className="flex items-center gap-2 font-jakarta text-xs font-bold uppercase tracking-widest text-gray-400">
                      <ShieldAlert size={13} className="text-rose-500" /> Direct Competitors
                    </h4>
                    {result.directCompetitors.map((competitor) => (
                      <CompetitorCard key={competitor.name} competitor={competitor} variant="direct" />
                    ))}
                  </section>
                )}

                {result.indirectCompetitors.length > 0 && (
                  <section className="space-y-3">
                    <h4 className="flex items-center gap-2 font-jakarta text-xs font-bold uppercase tracking-widest text-gray-400">
                      <Target size={13} className="text-blue-600" /> Indirect Competitors
                    </h4>
                    {result.indirectCompetitors.map((competitor) => (
                      <CompetitorCard key={competitor.name} competitor={competitor} variant="indirect" />
                    ))}
                  </section>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-600" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Positioning Gaps</h4>
                    </div>
                    <div className="space-y-2">
                      {result.positioningGaps.map((gap, index) => (
                        <Badge key={index} variant="sage" size="md" className="h-auto w-full justify-start whitespace-normal py-1.5 text-left">
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap size={14} className="text-amber-700" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">White Space Opportunities</h4>
                    </div>
                    <div className="space-y-2">
                      {result.whiteSpaceOpportunities.map((opportunity, index) => (
                        <Badge key={index} variant="cocoa" size="md" className="h-auto w-full justify-start whitespace-normal py-1.5 text-left">
                          {opportunity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                  <div className="mb-3 flex items-center gap-2">
                    <Swords size={14} className="text-teal-600" />
                    <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">How to Beat Them</h4>
                  </div>
                  <div className="space-y-2">
                    {result.howToBeatThem.map((strategy, index) => (
                      <div key={index} className="flex items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50 p-3">
                        <span className="mt-0.5 font-jakarta text-xs font-bold text-teal-700">{String(index + 1).padStart(2, "0")}</span>
                        <p className="font-jakarta text-sm leading-relaxed text-gray-650">{strategy}</p>
                      </div>
                    ))}
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

function CompetitorErrorState({
  message,
  detail,
  code,
  retryDisabled,
  onRetry,
  onEdit,
}: {
  message: string;
  detail: string;
  code: string;
  retryDisabled: boolean;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div role="alert" aria-live="polite" className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm shadow-rose-100/60">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
        <ShieldAlert size={20} className="text-rose-500" />
      </div>
      <div className="mt-4 space-y-2">
        <p className="font-jakarta text-base font-bold text-gray-950">{code === "PROVIDER_TIMEOUT" ? "Analysis took too long" : "Analysis could not be completed"}</p>
        <p className="mx-auto max-w-md font-jakarta text-sm leading-relaxed text-gray-600">
          {detail || "The analysis provider returned an unexpected response. Your input was not lost. Please try again."}
        </p>
        <p className="mx-auto max-w-md font-jakarta text-xs leading-relaxed text-gray-400">
          {message || GENERIC_ANALYSIS_ERROR}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={onRetry} disabled={retryDisabled} icon={<Swords size={13} />}>
          Try again
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit inputs
        </Button>
      </div>
    </div>
  );
}

function ContextCard({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "amber" | "blue" | "teal" }) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    teal: "border-teal-200 bg-teal-50 text-teal-700",
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

function CompetitorCard({ competitor, variant }: { competitor: Competitor; variant: "direct" | "indirect" }) {
  const color = variant === "direct" ? "#ec6e38" : "#4a63b5";

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-jakarta text-base font-bold text-gray-950">{competitor.name}</span>
            {competitor.url && (
              <a href={competitor.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 transition-colors hover:text-gray-700" aria-label={`Open ${competitor.name}`}>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          <p className="mt-1 font-jakarta text-sm leading-relaxed text-gray-500">{competitor.description}</p>
        </div>
        <Badge variant={variant === "direct" ? "peach" : "midnight"} size="sm">
          {variant}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
          <p className="mb-2 font-jakarta text-[10px] font-bold uppercase text-emerald-700">Strengths</p>
          {competitor.strengths.map((strength, index) => (
            <p key={index} className="mb-1 flex gap-1.5 font-jakarta text-xs leading-relaxed text-gray-600">
              <span className="text-emerald-700">+</span>
              {strength}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
          <p className="mb-2 font-jakarta text-[10px] font-bold uppercase text-rose-600">Weaknesses</p>
          {competitor.weaknesses.map((weakness, index) => (
            <p key={index} className="mb-1 flex gap-1.5 font-jakarta text-xs leading-relaxed text-gray-600">
              <span style={{ color }}>-</span>
              {weakness}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-3 font-jakarta text-xs font-semibold text-gray-500">
        <ArrowRight size={13} style={{ color }} />
        Watch for messaging, pricing, onboarding, and niche focus gaps.
      </div>
    </div>
  );
}
