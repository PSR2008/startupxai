import type { ReactNode } from "react";
import { CalendarDays, FileText } from "lucide-react";
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
          <li key={index} className="rounded-xl border border-black/6 bg-gray-50 p-3">
            {typeof item === "object" && item !== null ? renderObject(item as Record<string, unknown>) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object" && value !== null) {
    return renderObject(value as Record<string, unknown>);
  }

  return <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{String(value)}</p>;
}

function renderGeneratedSection(section: FounderReportContent["sections"][number]) {
  return (
    <section key={section.title} className="break-inside-avoid rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
      <h2 className="font-bricolage text-base font-bold text-gray-900 mb-2">{section.title}</h2>
      {section.body && (
        <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{section.body}</p>
      )}
      {section.items && section.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {section.items.map((item, index) => (
            <li key={index} className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 font-jakarta text-sm text-gray-650 leading-relaxed">
              <span className="font-bricolage text-xs font-bold text-emerald-700">{String(index + 1).padStart(2, "0")}</span>
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
          <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            {formatLabel(key)}
          </p>
          {renderValue(item)}
        </div>
      ))}
    </div>
  );
}

export default function ReportRenderer({ report }: { report: RenderableReport }) {
  return (
    <>
      <div className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <FileText size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bricolage text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
              {ENGINE_LABELS[report.engine_type] ?? report.engine_type}
            </p>
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">{getReportTitle(report)}</h1>
            <p className="font-jakarta text-sm text-gray-400 flex items-center gap-1.5">
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

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <section className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm h-fit">
          <h2 className="font-bricolage text-sm font-bold text-gray-900 mb-4">Input</h2>
          {renderObject(report.input_data)}
        </section>

        <section className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
          <h2 className="font-bricolage text-sm font-bold text-gray-900 mb-4">Report Output</h2>
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
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-sm break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div>
            <p className="font-bricolage text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">
              StartupX AI
            </p>
            <h1 className="font-bricolage text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight">
              {content.title}
            </h1>
            <p className="font-jakarta text-sm text-gray-500 mt-3 max-w-2xl">{content.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-right">
            <p className="font-bricolage text-[10px] font-bold text-gray-400 uppercase tracking-wide">Generated</p>
            <p className="font-jakarta text-xs text-gray-600">
              {new Date(content.generatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 break-inside-avoid">
        {[
          ["Startup", content.startup.name],
          ["Audience", content.startup.targetAudience || "Not provided"],
          ["Market", [content.startup.industry, content.startup.region].filter(Boolean).join(" / ") || "Not provided"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm">
            <p className="font-bricolage text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="font-jakarta text-sm text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </section>

      {content.startup.summary && (
        <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm break-inside-avoid">
          <h2 className="font-bricolage text-base font-bold text-gray-900 mb-2">One-Line Concept Summary</h2>
          <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{content.startup.summary}</p>
        </section>
      )}

      <div className={isMemo ? "space-y-3 memo-layout" : isSlides ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
        {content.sections.map(renderGeneratedSection)}
      </div>

      {content.nextActions.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm break-inside-avoid">
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

      <section className="rounded-2xl border border-black/6 bg-gray-50 p-4 break-inside-avoid">
        <p className="font-jakarta text-xs text-gray-500 leading-relaxed">{content.disclaimer}</p>
      </section>
    </article>
  );
}
