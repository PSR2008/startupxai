"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, History, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

interface ReportSummary {
  id: string;
  engine_type: string;
  input_data?: Record<string, unknown>;
  created_at: string;
}

const ENGINE_LABELS: Record<string, string> = {
  idea: "Idea & Market",
  competitor: "Competitor Intelligence",
  revenue: "Revenue Engine",
  psychology: "User Psychology",
  growth: "Growth Engine",
  decision: "Founder Decision",
  "cold-dm": "ColdDM AI",
  "brand-forge": "BrandForge AI",
};

function getReportTitle(report: ReportSummary): string {
  const input = report.input_data ?? {};
  const primary =
    input.idea ??
    input.product ??
    input.startupUrl ??
    input.competitorNames ??
    input.targetAudience;

  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }

  return ENGINE_LABELS[report.engine_type] ?? "Saved report";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecentReports({ limit = 6 }: { limit?: number }) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const res = await fetch(`/api/reports?limit=${limit}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setReports(data.reports ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReports();
    return () => {
      mounted = false;
    };
  }, [limit]);

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm h-full">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <History size={15} className="text-emerald-600" />
          <h3 className="font-bricolage text-sm font-bold text-gray-900">Recent Reports</h3>
        </div>
        <span className="font-jakarta text-[11px] text-gray-400">{reports.length} saved</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-400 font-jakarta text-sm">
          <Loader2 size={15} className="animate-spin" />
          Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-gray-50 p-5">
          <FileText size={18} className="text-gray-300 mb-3" />
          <p className="font-bricolage text-sm font-bold text-gray-800 mb-1">No reports yet</p>
          <p className="font-jakarta text-xs text-gray-400 leading-relaxed">
            Run any engine while signed in and your reports will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <div className="group rounded-xl border border-black/6 bg-gray-50 px-4 py-3 hover:bg-white hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bricolage text-sm font-bold text-gray-900 truncate">
                      {getReportTitle(report)}
                    </p>
                    <p className="font-jakarta text-xs text-gray-400">
                      {ENGINE_LABELS[report.engine_type] ?? report.engine_type} - {formatDate(report.created_at)}
                    </p>
                  </div>
                  <ArrowRight size={13} className="text-gray-300 group-hover:text-emerald-600 transition-colors flex-shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
