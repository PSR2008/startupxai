"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, BarChart3, ClipboardList, Database, FlaskConical, Link2, SearchCheck, ShieldCheck } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import { ConfidenceBadge, DataFreshnessBadge, EvidenceCard, MethodologyDrawer, ProviderStatus, ValidationDecisionPanel } from "@/components/app/EvidenceUI";
import { getAuthHeaders } from "@/lib/auth-headers-client";
import { EVIDENCE_SCORE_DISCLAIMER, getScoreEvidenceMetrics } from "@/lib/evidence-display";
import type { CategoryScore, EvidenceEngineInput, ValidationProjectResult } from "@/lib/evidence-types";

type FormState = EvidenceEngineInput;

const defaultForm: FormState = {
  startupName: "",
  ideaDescription: "",
  targetCustomer: "",
  targetGeography: "",
  businessModel: "",
  industry: "",
  developmentStage: "idea",
  knownCompetitors: "",
  mainAssumptions: "",
  websiteUrl: "",
};

const stageOptions = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "launched", label: "Launched" },
  { value: "revenue", label: "Revenue" },
  { value: "scaling", label: "Scaling" },
];

export default function EvidenceEnginePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ValidationProjectResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("");

  useEffect(() => {
    async function loadFounderProfile() {
      try {
        const res = await fetch("/api/founder-profile", { headers: await getAuthHeaders() });
        const data = await res.json();
        if (!res.ok || !data.profile) return;
        setForm((prev) => ({
          ...prev,
          startupName: prev.startupName || data.profile.startup_idea || "",
          ideaDescription: prev.ideaDescription || data.profile.product_summary || "",
          targetCustomer: prev.targetCustomer || data.profile.target_audience || "",
          targetGeography: prev.targetGeography || data.profile.region || "",
          industry: prev.industry || data.profile.industry || "",
        }));
      } catch {
        // best-effort personalization
      }
    }
    loadFounderProfile();
  }, []);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.startupName.trim()) next.startupName = "Required";
    if (form.ideaDescription.trim().length < 25) next.ideaDescription = "Describe the idea in at least 25 characters";
    if (!form.targetCustomer.trim()) next.targetCustomer = "Required";
    if (!form.targetGeography.trim()) next.targetGeography = "Required";
    if (!form.businessModel.trim()) next.businessModel = "Required";
    if (!form.industry.trim()) next.industry = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setStatus("loading");
    setResult(null);
    setErrorMessage("");
    try {
      const res = await fetch("/api/evidence-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Evidence validation failed");
      setResult(data.data);
      setActiveCategory(data.data.scores?.[0]?.category ?? "");
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Evidence validation failed");
      setStatus("error");
    }
  };

  const activeScore = result?.scores.find((score) => score.category === activeCategory) ?? result?.scores[0];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <EngineHeader
        icon={<SearchCheck size={22} />}
        title="Evidence Engine"
        description="Assess your startup or SaaS assumptions using visible evidence, confidence levels, transparent score weights, and explicit uncertainty before you build."
        badge="Evidence-backed workflow"
        badgeVariant="forest"
        accentColor="#059669"
      />

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { icon: Database, title: "Evidence first", detail: "Claims, verified sources, and unavailable data are separated." },
          { icon: BarChart3, title: "Transparent scores", detail: "Every Evidence Score shows components, confidence, and missing inputs." },
          { icon: FlaskConical, title: "Experiments", detail: "Weak assumptions become practical tests." },
          { icon: ShieldCheck, title: "No fake sources", detail: "Missing provider data is shown as unavailable." },
        ].map(({ icon: Icon, title, detail }) => (
          <div key={title} className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm">
            <Icon size={16} className="text-emerald-600" />
            <p className="mt-2 font-bricolage text-sm font-bold text-gray-900">{title}</p>
            <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bricolage text-base font-bold text-gray-900">Evidence project</h3>
              <p className="mt-1 font-jakarta text-xs text-gray-500">Create one durable project for evidence, scores, assumptions, and experiments.</p>
            </div>
            <Input label="Startup name" value={form.startupName} onChange={set("startupName")} error={errors.startupName} required />
            <Textarea label="Concise idea description" rows={4} value={form.ideaDescription} onChange={set("ideaDescription")} error={errors.ideaDescription} required charCount maxChars={1500} />
            <Textarea label="Target customer" rows={3} value={form.targetCustomer} onChange={set("targetCustomer")} error={errors.targetCustomer} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Target geography" value={form.targetGeography} onChange={set("targetGeography")} error={errors.targetGeography} required />
              <Input label="Industry" value={form.industry} onChange={set("industry")} error={errors.industry} required />
            </div>
            <Input label="Business model" placeholder="Subscription, usage, marketplace, services..." value={form.businessModel} onChange={set("businessModel")} error={errors.businessModel} required />
            <Select label="Stage" options={stageOptions} value={form.developmentStage} onChange={set("developmentStage")} />
            <Textarea label="Known competitors" rows={3} value={form.knownCompetitors} onChange={set("knownCompetitors")} hint="Names or URLs. URLs are checked server-side with SSRF protection." />
            <Textarea label="Main assumptions" rows={3} value={form.mainAssumptions} onChange={set("mainAssumptions")} hint="Separate assumptions with commas or new lines." />
            <Input label="Website" type="url" placeholder="https://example.com" value={form.websiteUrl} onChange={set("websiteUrl")} leftIcon={<Link2 size={14} />} />
          </section>

          <Button size="lg" fullWidth onClick={submit} loading={status === "loading"} icon={<ArrowRight size={16} />} iconPosition="right">
            {status === "loading" ? "Building evidence project..." : "Run Evidence Assessment"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.section key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center shadow-sm">
                <SearchCheck size={30} className="mx-auto text-emerald-600" />
                <h3 className="mt-4 font-bricolage text-lg font-bold text-gray-900">Ready for structured assessment</h3>
                <p className="mx-auto mt-2 max-w-md font-jakarta text-sm leading-relaxed text-gray-500">
                  This workflow will not invent source links, market size, search volume, or competitor facts. Unavailable evidence stays visibly unavailable.
                </p>
              </motion.section>
            )}

            {status === "loading" && <AnalysisLoading engine="evidence" />}
            {status === "error" && <ErrorState message={errorMessage} onRetry={() => setStatus("idle")} />}

            {status === "success" && result && activeScore && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <section className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bricolage text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Evidence project</p>
                      <h2 className="mt-1 font-bricolage text-2xl font-bold text-gray-950">{result.project.startupName}</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ConfidenceBadge confidence={result.project.confidence} />
                        <DataFreshnessBadge />
                        <Badge variant="neutral" size="sm">{result.project.scoreVersion}</Badge>
                      </div>
                    </div>
                    <div className="max-w-xs rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
                      <p className="font-bricolage text-[10px] font-bold uppercase tracking-wide text-emerald-700">Evidence Score</p>
                      <p className="font-bricolage text-4xl font-bold text-emerald-800">{result.project.overallScore}</p>
                      <p className="mt-2 font-jakarta text-[11px] leading-relaxed text-emerald-900">{EVIDENCE_SCORE_DISCLAIMER}</p>
                    </div>
                  </div>
                </section>

                <ValidationDecisionPanel overallScore={result.project.overallScore} confidence={result.project.confidence} />

                <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {result.scores.map((score) => (
                    <button
                      key={score.category}
                      onClick={() => setActiveCategory(score.category)}
                      className={`rounded-2xl border p-3 text-left transition-colors ${activeCategory === score.category ? "border-emerald-300 bg-emerald-50" : "border-black/6 bg-white hover:bg-gray-50"}`}
                    >
                      <p className="font-bricolage text-xl font-bold text-gray-950">{score.score}</p>
                      <p className="mt-1 font-jakarta text-[11px] leading-tight text-gray-500">{score.label}</p>
                    </button>
                  ))}
                </section>

                <ScorePanel score={activeScore} />

                <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Database size={14} className="text-emerald-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Evidence collected</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {result.evidenceItems.map((item) => <EvidenceCard key={item.id} item={item} />)}
                  </div>
                </section>

                <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-blue-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Provider status</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {result.providerRuns.map((run) => <ProviderStatus key={`${run.providerName}-${run.status}`} run={run} />)}
                  </div>
                </section>

                <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <FlaskConical size={14} className="text-violet-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Recommended next validation actions</h3>
                  </div>
                  <div className="space-y-3">
                    {result.suggestedExperiments.map((experiment) => (
                      <div key={experiment.hypothesis} className="rounded-xl border border-black/6 bg-gray-50 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-bricolage text-sm font-bold text-gray-900">{experiment.experimentType}</p>
                          <Badge variant="violet" size="sm">{experiment.status}</Badge>
                        </div>
                        <p className="font-jakarta text-sm leading-relaxed text-gray-600">{experiment.hypothesis}</p>
                        <p className="mt-2 font-jakarta text-xs text-gray-500">Metric: {experiment.successMetric} - sample size {experiment.minimumSampleSize}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <ClipboardList size={14} className="mt-0.5 text-amber-700" />
                    <div>
                      <p className="font-bricolage text-xs font-bold text-amber-900">Limitations</p>
                      <ul className="mt-2 space-y-1">
                        {result.limitations.map((item) => <li key={item} className="font-jakarta text-xs leading-relaxed text-amber-800">{item}</li>)}
                      </ul>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ScorePanel({ score }: { score: CategoryScore }) {
  const metrics = getScoreEvidenceMetrics(score);
  return (
    <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bricolage text-lg font-bold text-gray-950">{score.label} Evidence Score</h3>
            <ConfidenceBadge confidence={score.confidence} />
            {metrics.insufficientEvidence && <Badge variant="amber" size="sm">Insufficient evidence</Badge>}
          </div>
          <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-600">{score.conclusion}</p>
        </div>
        <div className="sm:max-w-xs sm:text-right">
          <p className="font-bricolage text-4xl font-bold text-emerald-700">{score.score}</p>
          <p className="mt-2 font-jakarta text-[11px] leading-relaxed text-gray-500">{EVIDENCE_SCORE_DISCLAIMER}</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBlock label="Evidence count" value={String(metrics.evidenceCount)} />
        <MetricBlock label="Evidence quality" value={metrics.evidenceQuality} />
        <MetricBlock label="Missing evidence" value={String(metrics.missingEvidence.length)} />
        <MetricBlock label="Confidence level" value={metrics.confidenceLevel} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextBlock title="Supporting evidence" items={score.supportingEvidence} />
        <TextBlock title="Opposing evidence" items={score.opposingEvidence.length ? score.opposingEvidence : ["No opposing evidence captured yet."]} />
        <TextBlock title="Assumptions" items={score.assumptions} />
        <TextBlock title="Missing evidence" items={metrics.missingEvidence.length ? metrics.missingEvidence : ["No missing weighted inputs for this score."]} />
        <TextBlock title="How the score was calculated" items={[metrics.calculationSummary]} />
        <TextBlock title="What would improve the score" items={[metrics.improvementAction]} />
        <TextBlock title="Recommended next validation actions" items={[score.recommendedNextAction]} />
      </div>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">{score.uncertainty}</p>
      <div className="mt-4">
        <MethodologyDrawer score={score} />
      </div>
    </section>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/6 bg-gray-50 p-3">
      <p className="font-bricolage text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-bricolage text-sm font-bold capitalize text-gray-900">{value}</p>
    </div>
  );
}

function TextBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-black/6 bg-gray-50 p-3">
      <p className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-600">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => <li key={item} className="font-jakarta text-xs leading-relaxed text-gray-600">{item}</li>)}
      </ul>
    </div>
  );
}
