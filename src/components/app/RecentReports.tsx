"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, History, Loader2, Lock, Trash2, Trophy } from "lucide-react";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

interface ReportSummary {
  id: string;
  engine_type: string;
  input_data?: Record<string, unknown>;
  created_at: string;
}

interface ReportStats {
  totalReports: number;
  mostUsedEngine: string | null;
  lastAnalysisAt: string | null;
}

const ENGINE_LABELS: Record<string, string> = {
  idea: "Idea & Market",
  competitor: "Competitor Intelligence",
  revenue: "Revenue Engine",
  psychology: "User Psychology",
  growth: "Growth Engine",
  decision: "Founder Decision",
  "cold-dm": "ColdDM",
  "brand-forge": "BrandForge",
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
    return `${ENGINE_LABELS[report.engine_type] ?? "Report"} - ${primary.trim()}`;
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
  const [stats, setStats] = useState<ReportStats>({
    totalReports: 0,
    mostUsedEngine: null,
    lastAnalysisAt: null,
  });
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;
        setToken(session.access_token);

        const res = await fetch(`/api/reports?limit=${limit}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "FEATURE_NOT_AVAILABLE" || data?.error === "FEATURE_NOT_AVAILABLE") {
            setLocked(true);
          }
          return;
        }
        if (mounted) {
          setReports(data.reports ?? []);
          setStats(data.stats ?? { totalReports: 0, mostUsedEngine: null, lastAnalysisAt: null });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReports();
    return () => {
      mounted = false;
    };
  }, [limit]);

  const deleteReport = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReports((items) => items.filter((item) => item.id !== id));
        setStats((current) => ({
          ...current,
          totalReports: Math.max(0, current.totalReports - 1),
        }));
      }
    } finally {
      setBusyId(null);
    }
  };

  const clearHistory = async () => {
    if (!token || reports.length === 0) return;
    const confirmed = window.confirm("Clear all saved reports? This cannot be undone.");
    if (!confirmed) return;

    setClearing(true);
    try {
      const res = await fetch("/api/reports", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReports([]);
        setStats({ totalReports: 0, mostUsedEngine: null, lastAnalysisAt: null });
      }
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="surface-panel h-full p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <History size={15} className="text-emerald-600" />
          <h3 className="font-bricolage text-sm font-bold text-gray-900">Recent Reports</h3>
        </div>
        {reports.length > 0 && (
          <button
            onClick={clearHistory}
            disabled={clearing}
            className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 font-jakarta text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
          >
            {clearing ? "Clearing..." : "Clear history"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-400 font-jakarta text-sm">
          <Loader2 size={15} className="animate-spin" />
          Loading reports...
        </div>
      ) : locked ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <Lock size={18} className="text-amber-600 mb-3" />
          <p className="font-bricolage text-sm font-bold text-amber-900 mb-1">Saved history starts on Founder</p>
          <p className="font-jakarta text-xs text-amber-700 leading-relaxed mb-3">
            Starter lets you explore the core engines. Upgrade to save reports, export PDFs, and use every intelligence engine.
          </p>
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="h-9 rounded-lg bg-amber-700 px-3.5 font-jakarta text-xs font-semibold text-white transition-colors hover:bg-amber-800">
              Upgrade to Founder
            </button>
          </Link>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/10 bg-[#f8f6f0] p-5">
          <FileText size={18} className="text-gray-300 mb-3" />
          <p className="font-bricolage text-sm font-bold text-gray-800 mb-1">No reports yet</p>
          <p className="font-jakarta text-xs text-gray-400 leading-relaxed">
            Run any engine while signed in and your reports will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <MagicBentoGrid className="grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="16, 185, 129" spotlightOpacity={0.06}>
            {[
              { icon: FileText, label: "Total reports", value: String(stats.totalReports) },
              { icon: Trophy, label: "Top engine", value: stats.mostUsedEngine ? ENGINE_LABELS[stats.mostUsedEngine] ?? stats.mostUsedEngine : "Not enough data" },
              { icon: CalendarDays, label: "Last run", value: stats.lastAnalysisAt ? formatDate(stats.lastAnalysisAt) : "Not yet" },
            ].map(({ icon: Icon, label, value }) => (
              <MagicBentoCard key={label} className="surface-inset p-4">
                <Icon size={14} className="text-emerald-600 mb-2" />
                <p className="metadata-text">{label}</p>
                <p className="font-jakarta text-sm text-gray-800 truncate">{value}</p>
              </MagicBentoCard>
            ))}
          </MagicBentoGrid>

          <MagicBentoGrid className="space-y-2" preset="app" glowColor="16, 185, 129" spotlightOpacity={0.06}>
            {reports.map((report) => (
              <MagicBentoCard key={report.id} className="group rounded-lg border border-black/8 bg-[#f8f6f0] px-4 py-3 transition-all hover:bg-white hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/reports/${report.id}`} className="min-w-0 flex-1">
                    <p className="font-bricolage text-sm font-bold text-gray-900 truncate">
                      {getReportTitle(report)}
                    </p>
                    <p className="font-jakarta text-xs text-gray-400">
                      {formatDate(report.created_at)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteReport(report.id)}
                      disabled={busyId === report.id}
                      title="Delete report"
                      className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    >
                      {busyId === report.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                    <Link href={`/reports/${report.id}`} className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700">
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </MagicBentoCard>
            ))}
          </MagicBentoGrid>
        </div>
      )}
    </div>
  );
}
