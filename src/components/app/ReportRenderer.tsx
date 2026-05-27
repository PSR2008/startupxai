import type { ReactNode } from "react";
import { CalendarDays, FileText } from "lucide-react";

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
  "cold-dm": "ColdDM AI",
  "brand-forge": "BrandForge AI",
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
