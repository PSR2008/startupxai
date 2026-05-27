"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, Loader2 } from "lucide-react";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

interface ReportDetail {
  id: string;
  engine_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  created_at: string;
}

const ENGINE_LABELS: Record<string, string> = {
  idea: "Idea & Market Engine",
  competitor: "Competitor Intelligence",
  revenue: "Revenue Engine",
  psychology: "User Psychology Engine",
  growth: "Growth Engine",
  decision: "Founder Decision Engine",
  "cold-dm": "ColdDM AI",
  "brand-forge": "BrandForge AI",
};

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

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          router.push("/signin");
          return;
        }

        const res = await fetch(`/api/reports/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Unable to load report");
        }

        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load report");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [params.id, router]);

  const title = useMemo(() => {
    if (!report) return "Report";
    const input = report.input_data ?? {};
    const primary = input.idea ?? input.product ?? input.targetAudience;
    return typeof primary === "string" && primary.trim()
      ? primary.trim()
      : ENGINE_LABELS[report.engine_type] ?? "Saved report";
  }, [report]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-black/6 bg-white p-8 shadow-sm flex items-center gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-jakarta text-sm">Loading report...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm mb-6">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <p className="font-bricolage text-sm font-bold text-rose-700">Report unavailable</p>
          <p className="font-jakarta text-sm text-rose-600 mt-1">{error || "This report could not be found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <ExportPdfButton />
      </div>

      <div className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <FileText size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bricolage text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
              {ENGINE_LABELS[report.engine_type] ?? report.engine_type}
            </p>
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">{title}</h1>
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
    </div>
  );
}
