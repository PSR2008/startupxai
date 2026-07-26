import type { ReactNode } from "react";
import { CalendarDays, FileText } from "lucide-react";
import { EVIDENCE_SCORE_DISCLAIMER } from "@/lib/evidence-display";
import type { FounderReportContent, GeneratedReport } from "@/lib/reporting";

export interface RenderableReport {
  id: string;
  engine_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  created_at: string;
}

export const ENGINE_LABELS: Record<string, string> = {
  idea: "Idea & Market Engine",
  competitor: "Competitor Intelligence",
  revenue: "Revenue Engine",
  psychology: "User Psychology Engine",
  growth: "Growth Engine",
  decision: "Founder Decision Engine",
  "cold-dm": "ColdDM",
  "brand-forge": "BrandForge",
};

export function getReportTitle(report: RenderableReport): string {
  const input = report.input_data ?? {};
  const primary = input.idea ?? input.product ?? input.targetAudience;
  return typeof primary === "string" && primary.trim()
    ? `${ENGINE_LABELS[report.engine_type] ?? "Report"} - ${primary.trim()}`
    : ENGINE_LABELS[report.engine_type] ?? "Saved report";
}

function formatLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={index} className="surface-inset p-3">
            {typeof item === "object" && item !== null ? renderObject(item as Record<string, unknown>) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object" && value !== null) {
    return renderObject(value as Record<string, unknown>);
  }

  return <p className="break-words font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{String(value)}</p>;
}

function renderGeneratedSection(section: FounderReportContent["sections"][number]) {
  return (
    <section key={section.title} className="surface-panel break-inside-avoid p-5">
      <h2 className="font-bricolage text-base font-bold text-gray-950 mb-2">{section.title}</h2>
      {section.body && (
        <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{section.body}</p>
      )}
      {section.items && section.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {section.items.map((item, index) => (
            <li key={index} className="flex gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 font-jakarta text-sm text-gray-650 leading-relaxed">
              <span className="font-mono text-xs font-semibold text-emerald-700">{String(index + 1).padStart(2, "0")}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function renderObject(value: Record<string, unknown>) {
  return (
    <div className="space-y-3">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <p className="mb-1 font-jakarta text-xs font-semibold text-gray-500">
            {formatLabel(key)}
          </p>
          {renderValue(item)}
        </div>
      ))}
    </div>
  );
}

function firstPresent(output: Record<string, unknown>, keys: string[]): unknown {
  return keys.map((key) => output[key]).find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return typeof value === "string" && value.trim().length > 0;
  });
}

function renderEvidenceAssessmentSummary(output: Record<string, unknown>): ReactNode | null {
  const scoreDetails = firstPresent(output, ["scores", "scoreComponents", "calculationComponents", "componentCalculations"]);
  const confidenceDetails = firstPresent(output, ["confidenceExplanation", "confidenceReasons", "confidence"]);
  const evidenceProvenance = firstPresent(output, ["evidenceProvenance", "evidenceItems", "sources"]);
  const missingEvidence = firstPresent(output, ["missingEvidence", "validationGaps", "limitations"]);
  const recommendedTests = firstPresent(output, ["recommendedTests", "suggestedExperiments", "nextValidationActions"]);

  if (!scoreDetails && !confidenceDetails && !evidenceProvenance && !missingEvidence && !recommendedTests) {
    return null;
  }

  const sections = [
    ["Score calculation", scoreDetails],
    ["Confidence explanation", confidenceDetails],
    ["Evidence provenance", evidenceProvenance],
    ["Missing evidence and contradictions", missingEvidence],
    ["Recommended next tests", recommendedTests],
  ] as const;

  return (
    <div className="mb-5 space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div>
        <h3 className="font-bricolage text-sm font-bold text-amber-950">Evidence assessment transparency</h3>
        <p className="mt-1 font-jakarta text-xs leading-relaxed text-amber-900">{EVIDENCE_SCORE_DISCLAIMER}</p>
      </div>
      <div className="space-y-3">
        {sections.map(([title, value]) => value ? (
          <div key={title} className="rounded-lg border border-black/6 bg-white/75 p-3">
            <p className="mb-2 font-jakarta text-xs font-semibold text-gray-700">{title}</p>
            {renderValue(value)}
          </div>
        ) : null)}
      </div>
    </div>
  );
}

export default function ReportRenderer({ report }: { report: RenderableReport }) {
  const evidenceSummary = renderEvidenceAssessmentSummary(report.output_data);

  return (
    <>
      <div className="surface-panel mb-5 overflow-hidden p-0">
        <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-amber-400" />
        <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <FileText size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="mb-1 font-jakarta text-xs font-semibold text-emerald-700">
              {ENGINE_LABELS[report.engine_type] ?? report.engine_type}
            </p>
            <h1 className="font-bricolage text-2xl sm:text-3xl font-bold text-gray-950 mb-2">{getReportTitle(report)}</h1>
            <p className="font-jakarta text-sm text-gray-500 flex items-center gap-1.5">
              <CalendarDays size={13} />
              {new Date(report.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <section className="surface-panel h-fit p-5">
          <h2 className="font-bricolage text-sm font-bold text-gray-950 mb-4">Input</h2>
          {renderObject(report.input_data)}
        </section>

        <section className="surface-panel min-w-0 p-5">
          <h2 className="font-bricolage text-sm font-bold text-gray-950 mb-4">Report Output</h2>
          {evidenceSummary}
          {renderObject(report.output_data)}
        </section>
      </div>
    </>
  );
}

export function GeneratedReportRenderer({ report }: { report: GeneratedReport }) {
  const content = report.content;
  const isMemo = content.reportType === "investor_memo";
  const isSlides = content.reportType === "slide_summary";

  return (
    <article className="report-document space-y-5">
      <section className="break-inside-avoid overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-emerald-700 via-emerald-500 to-amber-400" />
        <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div>
            <p className="mb-2 font-jakarta text-xs font-semibold text-emerald-700">
              StartupX AI
            </p>
            <h1 className="font-bricolage text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight">
              {content.title}
            </h1>
            <p className="font-jakarta text-sm text-gray-500 mt-3 max-w-2xl">{content.subtitle}</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/80 px-4 py-3 text-right">
            <p className="metadata-text">Generated</p>
            <p className="font-jakarta text-xs text-gray-600">
              {new Date(content.generatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 break-inside-avoid">
        {[
          ["Startup", content.startup.name],
          ["Audience", content.startup.targetAudience || "Not provided"],
          ["Market", [content.startup.industry, content.startup.region].filter(Boolean).join(" / ") || "Not provided"],
        ].map(([label, value]) => (
          <div key={label} className="surface-panel p-4">
            <p className="metadata-text">{label}</p>
            <p className="font-jakarta text-sm text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </section>

      {content.startup.summary && (
        <section className="surface-panel break-inside-avoid p-5">
          <h2 className="font-bricolage text-base font-bold text-gray-900 mb-2">One-Line Concept Summary</h2>
          <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{content.startup.summary}</p>
        </section>
      )}

      <div className={isMemo ? "space-y-3 memo-layout" : isSlides ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
        {content.sections.map(renderGeneratedSection)}
      </div>

      {content.nextActions.length > 0 && (
        <section className="break-inside-avoid rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="font-bricolage text-base font-bold text-emerald-900 mb-3">Recommended Next Seven Actions</h2>
          <ol className="space-y-2">
            {content.nextActions.map((action, index) => (
              <li key={index} className="font-jakarta text-sm text-emerald-800 leading-relaxed">
                {index + 1}. {action}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="surface-inset break-inside-avoid p-4">
        <p className="font-jakarta text-xs text-gray-500 leading-relaxed">{content.disclaimer}</p>
      </section>
    </article>
  );
}
