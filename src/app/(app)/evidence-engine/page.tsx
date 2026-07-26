"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, BarChart3, ClipboardList, Clock3, Database, ExternalLink, FlaskConical, Link2, NotebookPen, SearchCheck, ShieldCheck } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import { ConfidenceBadge, DataFreshnessBadge, EvidenceCard, MethodologyDrawer, ProviderStatus, ValidationDecisionPanel } from "@/components/app/EvidenceUI";
import { getAuthHeaders } from "@/lib/auth-headers-client";
import {
  EVIDENCE_SCORE_DISCLAIMER,
  getComponentCalculations,
  getConfidenceExplanation,
  getConfidenceImprovementItems,
  getDisplayedTotal,
  getEvidenceProvenance,
  getMissingEvidenceItems,
  getRecommendedTests,
  getScoreEvidenceMetrics,
} from "@/lib/evidence-display";
import type { CategoryScore, EvidenceEngineInput, ValidationProjectResult } from "@/lib/evidence-types";

type FormState = EvidenceEngineInput;

type PersistedEvidenceRow = {
  id: string;
  title: string;
  claim: string | null;
  summary: string;
  evidence_type: string;
  source_type?: string;
  source_url?: string | null;
  source_quality: string;
  confidence: string;
  evidence_direction?: string;
  raw_metadata?: Record<string, unknown> | null;
};

type PersistedInterviewRow = {
  id: string;
  participant_segment: string;
  interview_date: string;
  pain_severity: number;
};

type PersistedExperimentRow = {
  id: string;
  experiment_type: string;
  status: string;
  outcome: string | null;
};

type PersistedActivityRow = {
  id: string;
  title: string;
  created_at: string;
};

type WorkflowState = {
  evidence: PersistedEvidenceRow[];
  interviews: PersistedInterviewRow[];
  experiments: PersistedExperimentRow[];
  activity: PersistedActivityRow[];
};

type PublicSourcePreview = {
  metadata: {
    originalUrl: string;
    canonicalUrl: string;
    pageTitle: string | null;
    description: string | null;
    publisher: string | null;
    author: string | null;
    publicationDate: string | null;
    retrievedAt: string;
    language: string | null;
    faviconUrl: string | null;
    hostname: string;
    httpStatus: number;
    contentType: string;
    excerpt: string | null;
    label: "Public source - founder selected";
    explanation: string;
  };
  warnings: string[];
  duplicate: { id: string; title: string } | null;
};

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
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

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
      await loadWorkflow(data.data.project.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Evidence validation failed");
      setStatus("error");
    }
  };

  const activeScore = result?.scores.find((score) => score.category === activeCategory) ?? result?.scores[0];

  useEffect(() => {
    if (status !== "success" || !result) return;
    if (window.matchMedia("(min-width: 1280px)").matches) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status, result]);

  async function loadWorkflow(projectId: string) {
    const res = await fetch(`/api/evidence-projects/${projectId}`, { headers: await getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) setWorkflow(data.data);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
          <div key={title} className="surface-panel p-4">
            <Icon size={16} className="text-emerald-600" />
            <p className="mt-2 font-bricolage text-sm font-bold text-gray-900">{title}</p>
            <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)] xl:gap-8">
        <div className="min-w-0 space-y-5 xl:sticky xl:top-20">
          <section className="surface-panel space-y-5 p-6">
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

          <section className="surface-inset p-5">
            <div className="mb-4 flex items-center gap-2">
              <NotebookPen size={15} className="text-emerald-700" />
              <h3 className="font-bricolage text-sm font-bold text-gray-900">Manual evidence entry</h3>
            </div>
            <div className="space-y-3">
              <ManualEntry title="Add a source" detail="Paste a customer quote, public URL, support message, or research note after the assessment runs." />
              <ManualEntry title="Record interview" detail="Capture who was interviewed, what changed, and which assumption it supports or contradicts." />
              <ManualEntry title="Log experiment" detail="Record the metric, sample size, pass threshold, result, and decision impact." />
            </div>
          </section>

          <Button size="lg" fullWidth onClick={submit} loading={status === "loading"} icon={<ArrowRight size={16} />} iconPosition="right">
            {status === "loading" ? "Building evidence project..." : "Run Evidence Assessment"}
          </Button>
        </div>

        <div ref={resultRef} className="min-w-0 w-full max-w-full scroll-mt-20 [overflow-wrap:anywhere]">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.section key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-full rounded-xl border border-dashed border-black/10 bg-[#fffefa] p-6 text-center shadow-sm sm:p-10">
                <SearchCheck size={30} className="mx-auto text-emerald-600" />
                <h3 className="mt-4 font-bricolage text-lg font-bold text-gray-900">Ready for structured assessment</h3>
                <p className="mx-auto mt-2 max-w-md font-jakarta text-sm leading-relaxed text-gray-500">
                  This workflow will not invent source links, market size, search volume, or competitor facts. Unavailable evidence stays visibly unavailable.
                </p>
                <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
                  <EmptyHint title="What belongs here" detail="Founder context, source links, interview notes, and known assumptions." />
                  <EmptyHint title="Why it matters" detail="Weak evidence lowers confidence and shows what still needs research." />
                  <EmptyHint title="Next action" detail="Run the first assessment, then add sources and experiment results." />
                </div>
              </motion.section>
            )}

            {status === "loading" && <AnalysisLoading engine="evidence" />}
            {status === "error" && <ErrorState message={errorMessage} onRetry={() => setStatus("idle")} />}

            {status === "success" && result && activeScore && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-full min-w-0 space-y-5">
                <section className="surface-panel w-full max-w-full p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-jakarta text-xs font-semibold text-emerald-700">Evidence project</p>
                      <h2 className="mt-1 break-words font-bricolage text-2xl font-bold text-gray-950">{result.project.startupName}</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ConfidenceBadge confidence={result.project.confidence} />
                        <DataFreshnessBadge />
                        <Badge variant="neutral" size="sm">{result.project.scoreVersion}</Badge>
                      </div>
                    </div>
                    <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center sm:max-w-xs sm:flex-shrink-0">
                      <p className="metadata-text text-emerald-700">Evidence Score</p>
                      <p className="font-bricolage text-4xl font-bold text-emerald-800">{result.project.overallScore}</p>
                      <p className="mt-2 font-jakarta text-[11px] leading-relaxed text-emerald-900">{EVIDENCE_SCORE_DISCLAIMER}</p>
                    </div>
                  </div>
                </section>

                <AssessmentExplainability result={result} />

                <ValidationDecisionPanel overallScore={result.project.overallScore} confidence={result.project.confidence} />

                <PersistedWorkflowPanel
                  projectId={result.project.id}
                  workflow={workflow}
                  onRefresh={() => loadWorkflow(result.project.id)}
                />

                <section className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {result.scores.map((score) => (
                    <button
                      key={score.category}
                      onClick={() => setActiveCategory(score.category)}
                      className={`min-w-0 rounded-2xl border p-3 text-left transition-colors ${activeCategory === score.category ? "border-emerald-300 bg-emerald-50" : "border-black/6 bg-white hover:bg-gray-50"}`}
                    >
                      <p className="font-bricolage text-xl font-bold text-gray-950">{score.score}</p>
                      <p className="mt-1 font-jakarta text-[11px] leading-tight text-gray-500">{score.label}</p>
                    </button>
                  ))}
                </section>

                <ScorePanel score={activeScore} />

                <section id="assumptions" className="surface-panel w-full max-w-full p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardList size={14} className="text-amber-700" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Claim-to-evidence map</h3>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    {activeScore.assumptions.map((assumption) => (
                      <div key={assumption} className="surface-inset p-4">
                        <p className="font-bricolage text-xs font-bold text-gray-900">Assumption</p>
                        <p className="mt-1 font-jakarta text-sm leading-relaxed text-gray-600">{assumption}</p>
                        <p className="mt-3 font-jakarta text-xs text-amber-700">Link this to customer research or an experiment result before raising confidence.</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="surface-panel w-full max-w-full p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Database size={14} className="text-emerald-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Evidence used in this assessment</h3>
                  </div>
                  <EvidenceProvenanceList result={result} score={activeScore} />
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {result.evidenceItems.map((item) => <EvidenceCard key={item.id} item={item} />)}
                  </div>
                </section>

                <section className="surface-panel w-full max-w-full p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity size={14} className="text-blue-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Provider status</h3>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    {result.providerRuns.map((run) => <ProviderStatus key={`${run.providerName}-${run.status}`} run={run} />)}
                  </div>
                </section>

                <section id="experiments" className="surface-panel w-full max-w-full p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <FlaskConical size={14} className="text-violet-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Recommended next validation actions</h3>
                  </div>
                  <RecommendedTestsList result={result} />
                </section>

                <section className="w-full max-w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
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

                <section className="surface-panel w-full max-w-full p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock3 size={14} className="text-gray-600" />
                    <h3 className="font-bricolage text-sm font-bold text-gray-900">Project timeline</h3>
                  </div>
                  <div className="space-y-3">
                    <TimelineRow title="Assessment created" detail={`${result.evidenceItems.length} evidence item(s) collected and ${result.scores.length} score category summaries prepared.`} />
                    <TimelineRow title="Evidence gaps identified" detail={`${activeScore.components.filter((component) => component.evidenceKind === "unavailable").length} missing weighted input(s) remain for the selected score.`} />
                    <TimelineRow title="Next experiment drafted" detail={result.suggestedExperiments[0]?.hypothesis || "Add an experiment result after you run the first validation action."} />
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

function AssessmentExplainability({ result }: { result: ValidationProjectResult }) {
  const explanation = getConfidenceExplanation(result);
  const insufficient = result.project.confidence === "low";
  return (
    <section aria-labelledby="assessment-summary-heading" className="surface-panel w-full max-w-full p-5">
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="min-w-0">
          <p className="font-jakarta text-xs font-semibold text-emerald-700">Assessment summary</p>
          <h3 id="assessment-summary-heading" className="mt-1 break-words font-bricolage text-lg font-bold text-gray-950">
            {insufficient ? "Insufficient evidence for a reliable market conclusion." : explanation.label}
          </h3>
          <p className="mt-2 break-words font-jakarta text-sm leading-relaxed text-gray-600">{explanation.summary}</p>
          <p className="mt-2 break-words font-jakarta text-xs leading-relaxed text-gray-500">
            Assessment score measures current weighted evidence signals. Evidence confidence measures how much those signals rely on independent, recent, high-quality evidence. Decision readiness remains provisional until customer research and experiments are recorded.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="font-bricolage text-sm font-bold text-amber-950">Why confidence is currently {result.project.confidence}</h4>
          <ul className="mt-3 space-y-2">
            {explanation.reasons.map((reason) => (
              <li key={reason} className="break-words font-jakarta text-xs leading-relaxed text-amber-900">{reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function EvidenceProvenanceList({ result, score }: { result: ValidationProjectResult; score: CategoryScore }) {
  const provenance = getEvidenceProvenance(result.evidenceItems, score);
  if (!provenance.length) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-[#fbfaf7] p-4 font-jakarta text-sm text-gray-500">
        No linked evidence items were used for this selected score. Founder input and unavailable weighted components are still shown in the calculation.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
      {provenance.map((item) => (
        <article key={item.id} className="surface-inset min-w-0 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="break-words font-bricolage text-sm font-bold text-gray-900">{item.title}</h4>
              <p className="mt-1 break-words font-jakarta text-xs text-gray-500">{item.attribution}</p>
            </div>
            <Badge variant={item.direction === "contradicts" ? "rose" : item.direction === "supports" ? "emerald" : "neutral"} size="sm">{item.direction}</Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MetricBlock label="Source type" value={item.sourceLabel} />
            <MetricBlock label="Verification" value={item.verificationStatus} />
            <MetricBlock label="Public host" value={item.hostname ?? "Not applicable"} />
            <MetricBlock label="Retrieved" value={item.retrievedAt ? new Date(item.retrievedAt).toLocaleDateString() : "Not recorded"} />
          </div>
          <p className="mt-3 break-words font-jakarta text-xs leading-relaxed text-gray-600">Linked claim: {item.linkedClaim}</p>
          <p className="mt-2 break-words font-jakarta text-xs leading-relaxed text-gray-500">Impact: {item.resultImpact}</p>
        </article>
      ))}
    </div>
  );
}

function RecommendedTestsList({ result }: { result: ValidationProjectResult }) {
  const tests = getRecommendedTests(result.scores, result.suggestedExperiments);
  return (
    <div className="space-y-3">
      {tests.map((test) => (
        <div key={test.hypothesis} className="surface-inset p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 font-bricolage text-sm font-bold text-gray-900">{test.test}</p>
            <Badge variant="violet" size="sm">{test.evidenceType}</Badge>
          </div>
          <p className="font-jakarta text-sm leading-relaxed text-gray-600">{test.hypothesis}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MetricBlock label="Audience" value={test.targetAudience} />
            <MetricBlock label="Metric" value={test.metric} />
            <MetricBlock label="Threshold" value={test.successThreshold} />
            <MetricBlock label="Duration" value={test.duration} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScorePanel({ score }: { score: CategoryScore }) {
  const metrics = getScoreEvidenceMetrics(score);
  const calculations = getComponentCalculations(score);
  const missingItems = getMissingEvidenceItems(score);
  const confidenceImprovements = getConfidenceImprovementItems(score);
  const displayedTotal = getDisplayedTotal(score);
  return (
    <section className="surface-panel w-full max-w-full p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-bricolage text-lg font-bold text-gray-950">{score.label} Evidence Score</h3>
            <ConfidenceBadge confidence={score.confidence} />
            {metrics.insufficientEvidence && <Badge variant="amber" size="sm">Insufficient evidence</Badge>}
          </div>
          <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-600">{score.conclusion}</p>
        </div>
        <div className="w-full sm:max-w-xs sm:flex-shrink-0 sm:text-right">
          <p className="font-bricolage text-4xl font-bold text-emerald-700">{score.score}</p>
          <p className="mt-2 font-jakarta text-[11px] leading-relaxed text-gray-500">{EVIDENCE_SCORE_DISCLAIMER}</p>
        </div>
      </div>
      <div className="mb-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBlock label="Evidence count" value={String(metrics.evidenceCount)} />
        <MetricBlock label="Evidence quality" value={metrics.evidenceQuality} />
        <MetricBlock label="Missing evidence" value={String(metrics.missingEvidence.length)} />
        <MetricBlock label="Confidence level" value={metrics.confidenceLevel} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <TextBlock title="Supporting evidence" items={score.supportingEvidence} />
        <TextBlock title="Opposing evidence" items={score.opposingEvidence.length ? score.opposingEvidence : ["No opposing evidence captured yet."]} />
        <TextBlock title="Assumptions" items={score.assumptions} />
        <TextBlock title="What is still missing" items={missingItems.length ? missingItems.map((item) => `${item.title}: ${item.evidenceNeeded}. ${item.whyItMatters} ${item.confidenceImpact}`) : ["No missing weighted inputs for this score."]} />
        <TextBlock title="What would raise confidence" items={confidenceImprovements} />
        <TextBlock title="Recommended next validation actions" items={[score.recommendedNextAction]} />
      </div>
      <details className="mt-4 rounded-xl border border-black/8 bg-gray-50 p-4">
        <summary className="cursor-pointer list-none font-bricolage text-sm font-bold text-gray-900">How this was calculated</summary>
        <p className="mt-2 break-words font-jakarta text-xs leading-relaxed text-gray-500">{score.methodology}</p>
        <div className="mt-4 space-y-3">
          {calculations.map((item) => (
            <div key={item.componentName} className="rounded-lg border border-black/6 bg-white p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-bricolage text-sm font-bold text-gray-900">{item.componentName}</p>
                  <p className="mt-1 break-words font-jakarta text-xs leading-relaxed text-gray-500">{item.purpose}</p>
                </div>
                <Badge variant="neutral" size="sm">Weight {item.weightPercent}%</Badge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricBlock label="Raw result" value={`${item.rawScore}/100`} />
                <MetricBlock label="Weighted contribution" value={`${item.weightedContribution}/100`} />
                <MetricBlock label="Final contribution" value={`${item.finalContribution}`} />
                <MetricBlock label="Linked evidence" value={String(item.linkedEvidenceIds.length)} />
              </div>
              {(item.deductions.length > 0 || item.missingEvidence.length > 0) && (
                <ul className="mt-3 space-y-1">
                  {[...item.deductions, ...item.missingEvidence.map((missing) => `Missing evidence: ${missing}`)].map((reason) => (
                    <li key={reason} className="break-words font-jakarta text-xs leading-relaxed text-gray-600">{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 font-jakarta text-xs leading-relaxed text-emerald-900">
          Component contribution total: {displayedTotal}/100. Displayed score: {score.score}/100.
        </p>
      </details>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">{score.uncertainty}</p>
      <div className="mt-4">
        <MethodologyDrawer score={score} />
      </div>
    </section>
  );
}

function ManualEntry({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-black/8 bg-[#fffefa] p-3">
      <p className="font-bricolage text-xs font-bold text-gray-900">{title}</p>
      <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
    </div>
  );
}

function EmptyHint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-inset p-3">
      <p className="font-bricolage text-xs font-bold text-gray-900">{title}</p>
      <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
    </div>
  );
}

function TimelineRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-inset relative p-4">
      <p className="font-bricolage text-xs font-bold text-gray-900">{title}</p>
      <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
    </div>
  );
}

function PersistedWorkflowPanel({ projectId, workflow, onRefresh }: { projectId: string; workflow: WorkflowState | null; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [evidenceSource, setEvidenceSource] = useState<"founder_note" | "customer_interview" | "experiment_result" | "public_url" | "ai_suggestion_unverified">("founder_note");
  const [publicPreview, setPublicPreview] = useState<PublicSourcePreview | null>(null);
  const [publicPreviewInput, setPublicPreviewInput] = useState("");
  const [publicPreviewError, setPublicPreviewError] = useState("");
  const previewRef = useRef<HTMLDivElement | null>(null);

  const evidenceTypeForSource = {
    founder_note: "founder_provided_evidence",
    customer_interview: "customer_research",
    experiment_result: "experiment_result",
    public_url: "founder_provided_evidence",
    ai_suggestion_unverified: "generated_assessment",
  } as const;

  async function submit(path: string, formData: FormData, method = "POST") {
    setBusy(path);
    setMessage("");
    const entries = Object.fromEntries(formData.entries());
    const body: Record<string, unknown> = { ...entries };
    if ("convert_to_evidence" in entries) body.convert_to_evidence = entries.convert_to_evidence === "on";
    if ("pain_severity" in entries) body.pain_severity = Number(entries.pain_severity || 3);
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok || !data.success) {
      setMessage(data.error || "Could not save changes.");
      return;
    }
    setMessage("Saved. Score and activity history updated.");
    await onRefresh();
  }

  async function fetchPublicPreview(formData: FormData) {
    setBusy("public-preview");
    setMessage("");
    setPublicPreview(null);
    setPublicPreviewError("");
    const url = String(formData.get("source_url") ?? "");
    const res = await fetch("/api/evidence/source-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ projectId, url }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok || !data.success) {
      setPublicPreviewError(data.error || "Could not preview this source.");
      return;
    }
    setPublicPreviewInput(url);
    setPublicPreview(data.data);
    window.requestAnimationFrame(() => previewRef.current?.focus());
  }

  async function savePublicSource(formData: FormData) {
    if (!publicPreview || publicPreview.duplicate) return;
    const currentUrl = String(formData.get("source_url") ?? "");
    if (currentUrl !== publicPreviewInput) {
      setPublicPreviewError("Fetch source details again before saving this changed URL.");
      setPublicPreview(null);
      return;
    }
    const metadata = publicPreview.metadata;
    const claim = String(formData.get("claim") ?? "");
    const titleOverride = String(formData.get("title") ?? "").trim();
    const interpretation = String(formData.get("description") ?? "").trim();
    const body = {
      evidence_source: "public_url",
      evidence_type: "founder_provided_evidence",
      title: titleOverride || metadata.pageTitle || metadata.hostname,
      claim,
      description: interpretation || "Founder selected this public source for review.",
      evidence_direction: String(formData.get("evidence_direction") ?? "neutral"),
      source_url: metadata.canonicalUrl,
      source_name: metadata.publisher || metadata.hostname,
      source_quality: "medium",
      confidence: "low",
      collected_at: metadata.retrievedAt,
      evidence_status: "active",
      linked_claims: claim ? [claim] : [],
      public_source_metadata: metadata,
    };
    setBusy("public-save");
    setMessage("");
    const res = await fetch(`/api/evidence-projects/${projectId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok || !data.success) {
      setMessage(data.error || "Could not save public source.");
      return;
    }
    setPublicPreview(null);
    setMessage("Public source saved with attribution. Score and activity history updated.");
    await onRefresh();
  }

  async function deleteEvidence(id: string) {
    if (!window.confirm("Delete this evidence item? This cannot be undone.")) return;
    setBusy(id);
    const res = await fetch(`/api/evidence-projects/${projectId}/evidence/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    setBusy("");
    if (!res.ok) {
      setMessage("Could not delete evidence.");
      return;
    }
    setMessage("Evidence deleted. Score recalculated.");
    await onRefresh();
  }

  return (
    <section className="surface-panel w-full max-w-full p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bricolage text-sm font-bold text-gray-900">Persisted workflow</h3>
          <p className="font-jakarta text-xs text-gray-500">Add evidence, record interviews, log experiments, and keep real project activity.</p>
        </div>
        {message && <Badge variant={message.startsWith("Could") ? "rose" : "emerald"} size="sm" className="max-w-full whitespace-normal leading-snug">{message}</Badge>}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        <details className="surface-inset min-w-0 p-4">
          <summary className="cursor-pointer list-none font-bricolage text-sm font-bold text-gray-900">Add evidence</summary>
          <div className="mt-4 space-y-3">
            <label className="block min-w-0">
              <span className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-gray-600">Evidence source</span>
              <select
                value={evidenceSource}
                onChange={(event) => {
                  setEvidenceSource(event.target.value as typeof evidenceSource);
                  setPublicPreview(null);
                  setPublicPreviewError("");
                }}
                className="mt-1 h-9 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 font-jakarta text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="founder_note">Founder note</option>
                <option value="customer_interview">Customer interview</option>
                <option value="experiment_result">Experiment result</option>
                <option value="public_url">Public URL</option>
                <option value="ai_suggestion_unverified">AI suggestion - unverified</option>
              </select>
            </label>

            {evidenceSource === "public_url" ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (publicPreview) void savePublicSource(new FormData(e.currentTarget));
                  else void fetchPublicPreview(new FormData(e.currentTarget));
                }}
              >
                <MiniInput name="source_url" label="Public URL" type="url" required />
                <MiniInput name="title" label="Evidence title override" />
                <MiniInput name="claim" label="Related claim or assumption" required />
                <MiniSelect name="evidence_direction" label="Direction" options={["supporting", "contradicting", "neutral"]} />
                <MiniTextarea name="description" label="Founder interpretation" />
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">
                  Public URLs are founder-selected sources. StartupX AI retrieves metadata only; it does not decide whether the source proves the claim.
                </p>
                {publicPreviewError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-jakarta text-xs leading-relaxed text-rose-700">
                    {publicPreviewError}
                  </p>
                )}
                {publicPreview && (
                  <div ref={previewRef} tabIndex={-1} className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 outline-none focus:ring-2 focus:ring-blue-400/30">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="blue" size="sm">Public source - founder selected</Badge>
                      {publicPreview.duplicate && <Badge variant="amber" size="sm">Duplicate source detected</Badge>}
                    </div>
                    <p className="break-words font-bricolage text-sm font-bold text-gray-900">{publicPreview.metadata.pageTitle || "Page title unavailable"}</p>
                    <p className="mt-1 break-words font-jakarta text-xs text-gray-600">{publicPreview.metadata.publisher || publicPreview.metadata.hostname}</p>
                    <a href={publicPreview.metadata.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 break-all font-bricolage text-[11px] font-bold text-emerald-700">
                      {publicPreview.metadata.canonicalUrl} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                    <p className="mt-3 break-words font-jakarta text-xs leading-relaxed text-gray-600">{publicPreview.metadata.description || "Description unavailable"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {publicPreview.metadata.publicationDate && <Badge variant="neutral" size="sm">Published {new Date(publicPreview.metadata.publicationDate).toLocaleDateString()}</Badge>}
                      <Badge variant="neutral" size="sm">Retrieved {new Date(publicPreview.metadata.retrievedAt).toLocaleString()}</Badge>
                      <Badge variant="neutral" size="sm">{publicPreview.metadata.httpStatus} - {publicPreview.metadata.contentType}</Badge>
                    </div>
                    <p className="mt-3 font-jakarta text-xs leading-relaxed text-blue-900">
                      StartupX AI retrieved source metadata. The founder is responsible for deciding how this source relates to the claim.
                    </p>
                    {publicPreview.duplicate && (
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">
                        This project already has a saved evidence item for this URL: {publicPreview.duplicate.title}. Cancel or choose a different source.
                      </p>
                    )}
                    {publicPreview.warnings.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {publicPreview.warnings.map((warning) => <li key={warning} className="font-jakarta text-xs text-gray-500">{warning}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy !== ""} type="button" onClick={(e) => void fetchPublicPreview(new FormData(e.currentTarget.form!))} className="focus-ring h-9 rounded-lg border border-black/10 bg-white px-3 font-jakarta text-xs font-semibold text-gray-700 disabled:opacity-50">
                    {busy === "public-preview" ? "Fetching..." : "Fetch source details"}
                  </button>
                  <button disabled={busy !== "" || !publicPreview || Boolean(publicPreview.duplicate)} className="focus-ring h-9 rounded-lg bg-emerald-700 px-3 font-jakarta text-xs font-semibold text-white disabled:opacity-50">
                    {busy === "public-save" ? "Saving..." : "Save attributed evidence"}
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(`/api/evidence-projects/${projectId}/evidence`, new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
                <input type="hidden" name="evidence_source" value={evidenceSource} />
                <input type="hidden" name="evidence_type" value={evidenceTypeForSource[evidenceSource]} />
                <MiniInput name="title" label="Title" required />
                <MiniInput name="claim" label="Claim or assumption" required />
                <MiniTextarea name="description" label="Notes" required />
                <MiniSelect name="evidence_direction" label="Direction" options={["supporting", "contradicting", "neutral"]} />
                <MiniInput name="source_url" label="Source URL" />
                <MiniInput name="source_name" label="Source name" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <MiniSelect name="source_quality" label="Quality" options={["low", "medium", "high"]} />
                  <MiniSelect name="confidence" label="Confidence" options={["low", "medium", "high"]} />
                </div>
                {evidenceSource === "ai_suggestion_unverified" && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-jakarta text-xs leading-relaxed text-amber-900">
                    AI suggestions remain unverified until evidence is attached.
                  </p>
                )}
                <button disabled={busy !== ""} className="focus-ring h-9 rounded-lg bg-emerald-700 px-3 font-jakarta text-xs font-semibold text-white disabled:opacity-50">Add source</button>
              </form>
            )}
          </div>
        </details>

        <details className="surface-inset min-w-0 p-4">
          <summary className="cursor-pointer list-none font-bricolage text-sm font-bold text-gray-900">Record interview</summary>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(`/api/evidence-projects/${projectId}/interviews`, new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
            <MiniInput name="participant_segment" label="Participant segment" required />
            <MiniInput name="interview_date" label="Interview date" type="date" required />
            <MiniTextarea name="problem_discussed" label="Problem discussed" required />
            <MiniSelect name="pain_severity" label="Pain severity" options={["1", "2", "3", "4", "5"]} />
            <MiniTextarea name="key_quotes" label="Key quotes" />
            <MiniInput name="current_alternative" label="Current alternative" />
            <MiniInput name="willingness_to_pay_signal" label="Willingness-to-pay signal" />
            <MiniTextarea name="notes" label="Notes" />
            <MiniInput name="follow_up_action" label="Follow-up action" />
            <label className="flex items-start gap-2 font-jakarta text-xs text-gray-600">
              <input name="convert_to_evidence" type="checkbox" className="mt-0.5" />
              Convert this interview into customer-research evidence
            </label>
            <button disabled={busy !== ""} className="focus-ring h-9 rounded-lg bg-emerald-700 px-3 font-jakarta text-xs font-semibold text-white disabled:opacity-50">Record interview</button>
          </form>
        </details>

        <details className="surface-inset min-w-0 p-4">
          <summary className="cursor-pointer list-none font-bricolage text-sm font-bold text-gray-900">Track experiment</summary>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(`/api/evidence-projects/${projectId}/experiments`, new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
            <MiniTextarea name="hypothesis" label="Hypothesis" required />
            <MiniInput name="experiment_type" label="Experiment type" required />
            <MiniInput name="success_metric" label="Success metric" required />
            <MiniInput name="target_threshold" label="Target threshold" required />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <MiniInput name="start_date" label="Start date" type="date" />
              <MiniInput name="end_date" label="End date" type="date" />
            </div>
            <MiniSelect name="status" label="Status" options={["planned", "active", "completed", "closed"]} />
            <MiniInput name="measured_result" label="Measured result" />
            <MiniSelect name="outcome" label="Outcome" options={["inconclusive", "passed", "failed"]} />
            <MiniTextarea name="learning" label="Learning" />
            <MiniTextarea name="next_decision" label="Next decision" />
            <button disabled={busy !== ""} className="focus-ring h-9 rounded-lg bg-emerald-700 px-3 font-jakarta text-xs font-semibold text-white disabled:opacity-50">Create experiment</button>
          </form>
        </details>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-3">
        <PersistedList title="Stored evidence" empty="No manually added evidence yet.">
          {workflow?.evidence?.map((item) => (
            <div key={item.id} className="min-w-0 rounded-lg border border-black/6 bg-gray-50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-bricolage text-xs font-bold text-gray-900">{item.title}</p>
                  <p className="mt-1 break-words font-jakarta text-xs text-gray-500">{item.claim || item.summary}</p>
                  <p className="mt-1 break-words font-jakarta text-[11px] capitalize text-gray-400">{item.evidence_type.replaceAll("_", " ")} - {item.source_quality} quality - {item.confidence} confidence</p>
                </div>
                <button onClick={() => deleteEvidence(item.id)} disabled={busy === item.id} className="w-fit font-bricolage text-[11px] font-bold text-rose-600">Delete</button>
              </div>
              <details className="mt-3 rounded-md border border-black/6 bg-white p-2">
                <summary className="cursor-pointer list-none font-bricolage text-[11px] font-bold text-emerald-700">Edit evidence</summary>
                <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); submit(`/api/evidence-projects/${projectId}/evidence/${item.id}`, new FormData(e.currentTarget), "PATCH"); }}>
                  <MiniInput name="title" label="Title" defaultValue={item.title} />
                  <MiniInput name="claim" label="Claim" defaultValue={item.claim ?? ""} />
                  <MiniTextarea name="description" label="Notes" defaultValue={item.summary} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <MiniSelect name="source_quality" label="Quality" options={["low", "medium", "high"]} defaultValue={item.source_quality} />
                    <MiniSelect name="confidence" label="Confidence" options={["low", "medium", "high"]} defaultValue={item.confidence} />
                  </div>
                  <button disabled={busy !== ""} className="focus-ring h-8 rounded-lg bg-gray-900 px-3 font-bricolage text-[11px] font-bold text-white disabled:opacity-50">Save edit</button>
                </form>
              </details>
            </div>
          ))}
        </PersistedList>
        <PersistedList title="Interview history" empty="No customer interviews recorded yet.">
          {workflow?.interviews?.map((item) => (
            <div key={item.id} className="rounded-lg border border-black/6 bg-gray-50 p-3">
              <p className="font-bricolage text-xs font-bold text-gray-900">{item.participant_segment}</p>
              <p className="mt-1 font-jakarta text-xs text-gray-500">{item.interview_date} - pain severity {item.pain_severity}/5</p>
            </div>
          ))}
        </PersistedList>
        <PersistedList title="Experiment history" empty="No experiments recorded yet.">
          {workflow?.experiments?.map((item) => (
            <div key={item.id} className="rounded-lg border border-black/6 bg-gray-50 p-3">
              <p className="font-bricolage text-xs font-bold text-gray-900">{item.experiment_type}</p>
              <p className="mt-1 font-jakarta text-xs text-gray-500">{item.status}{item.outcome ? ` - ${item.outcome}` : ""}</p>
              {item.status !== "closed" && (
                <button
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("status", item.status === "planned" ? "active" : "closed");
                    submit(`/api/evidence-projects/${projectId}/experiments/${item.id}`, fd, "PATCH");
                  }}
                  className="mt-2 font-bricolage text-[11px] font-bold text-emerald-700"
                >
                  {item.status === "planned" ? "Start it" : "Close it"}
                </button>
              )}
            </div>
          ))}
        </PersistedList>
      </div>

      <PersistedList title="Activity history" empty="No persisted activity yet." className="mt-5">
        {workflow?.activity?.map((item) => (
          <div key={item.id} className="rounded-lg border border-black/6 bg-gray-50 p-3">
            <p className="font-bricolage text-xs font-bold text-gray-900">{item.title}</p>
            <p className="mt-1 font-jakarta text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
          </div>
        ))}
      </PersistedList>
    </section>
  );
}

function MiniInput({ label, name, type = "text", required = false, defaultValue = "" }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block min-w-0">
      <span className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-gray-600">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 font-jakarta text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
    </label>
  );
}

function MiniTextarea({ label, name, required = false, defaultValue = "" }: { label: string; name: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block min-w-0">
      <span className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-gray-600">{label}</span>
      <textarea name={name} required={required} rows={3} defaultValue={defaultValue} className="mt-1 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 py-2 font-jakarta text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
    </label>
  );
}

function MiniSelect({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue?: string }) {
  return (
    <label className="block min-w-0">
      <span className="font-bricolage text-[11px] font-bold uppercase tracking-wide text-gray-600">{label}</span>
      <select name={name} defaultValue={defaultValue} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 font-jakarta text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function PersistedList({ title, empty, children, className = "" }: { title: string; empty: string; children: React.ReactNode; className?: string }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-2 font-bricolage text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="space-y-2">
        {hasItems ? children : <div className="rounded-lg border border-dashed border-black/10 bg-[#fbfaf7] p-3 font-jakarta text-xs text-gray-500">{empty}</div>}
      </div>
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/6 bg-gray-50 p-3">
      <p className="font-bricolage text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 break-words font-bricolage text-sm font-bold capitalize text-gray-900">{value}</p>
    </div>
  );
}

function TextBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/6 bg-gray-50 p-3">
      <p className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-600">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => <li key={item} className="break-words font-jakarta text-xs leading-relaxed text-gray-600">{item}</li>)}
      </ul>
    </div>
  );
}
