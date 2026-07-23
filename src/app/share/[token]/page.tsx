"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import ReportRenderer, { GeneratedReportRenderer, type RenderableReport } from "@/components/app/ReportRenderer";
import type { GeneratedReport } from "@/lib/reporting";

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<RenderableReport | GeneratedReport | null>(null);
  const [reportKind, setReportKind] = useState<"analysis" | "generated_report">("analysis");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch(`/api/share/${params.token}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Shared report not found");
        setReport(data.report);
        setReportKind(data.reportKind === "generated_report" ? "generated_report" : "analysis");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Shared report not found");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [params.token]);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <header className="no-print border-b border-black/8 bg-[#fffefa]/92 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bricolage text-sm font-bold text-gray-900">StartupX AI</span>
          </Link>
          <Link href="/signup" className="font-jakarta text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            Create free account
          </Link>
        </div>
      </header>

      <main className="p-6 lg:p-8 max-w-5xl mx-auto">
        <Link href="/" className="no-print inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm mb-6">
          <ArrowLeft size={14} /> Back to StartupX AI
        </Link>

        {loading && (
          <div className="surface-panel flex items-center gap-2 p-8 text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="font-jakarta text-sm">Loading shared report...</span>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8">
            <p className="font-bricolage text-sm font-bold text-rose-700">Shared report unavailable</p>
            <p className="font-jakarta text-sm text-rose-600 mt-1">{error}</p>
          </div>
        )}

        {!loading && report && reportKind === "generated_report" && (
          <GeneratedReportRenderer report={report as GeneratedReport} />
        )}
        {!loading && report && reportKind === "analysis" && (
          <ReportRenderer report={report as RenderableReport} />
        )}
      </main>
    </div>
  );
}
