"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, FileText, Layout, Link2, Loader2, Newspaper, Trash2, X } from "lucide-react";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import ReportRenderer, { GeneratedReportRenderer, type RenderableReport } from "@/components/app/ReportRenderer";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { GeneratedReport, ReportOutputType, ShareExpiryOption } from "@/lib/reporting";

interface ReportDetail extends RenderableReport {
  share_token?: string | null;
  shared_at?: string | null;
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [generating, setGenerating] = useState<ReportOutputType | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [expiresIn, setExpiresIn] = useState<ShareExpiryOption>("none");

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
        setToken(session.access_token);

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

  const legacyShareUrl = useMemo(() => {
    if (!report?.share_token || typeof window === "undefined") return "";
    return `${window.location.origin}/share/${report.share_token}`;
  }, [report?.share_token]);
  const activeShareUrl = shareUrl || legacyShareUrl;

  const deleteReport = async () => {
    if (!token || !report) return;
    const confirmed = window.confirm("Delete this report? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Unable to delete report");
      router.push("/reports");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete report");
      setDeleting(false);
    }
  };

  const updateSharing = async (share: boolean, target: "analysis" | "generated_report" = generatedReport ? "generated_report" : "analysis") => {
    if (!token || !report) return;
    setSharing(true);
    try {
      const endpoint =
        target === "generated_report" && generatedReport
          ? `/api/generated-reports/${generatedReport.id}/share`
          : `/api/reports/${report.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ share, expiresIn }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to update sharing");

      setShareUrl(data.shareUrl && typeof window !== "undefined" ? `${window.location.origin}${data.shareUrl}` : "");
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update sharing");
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = async () => {
    if (!activeShareUrl) return;
    await navigator.clipboard.writeText(activeShareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const generateReport = async (reportType: ReportOutputType) => {
    if (!token || !report) return;
    setGenerating(reportType);
    setError("");
    try {
      const res = await fetch(`/api/reports/${report.id}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Your report could not be generated. Please try again.");
      setGeneratedReport(data.report);
      setShareUrl("");
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your report could not be generated. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="surface-panel flex items-center gap-2 p-8 text-gray-500">
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8">
          <p className="font-jakarta text-sm font-bold text-rose-700">Report unavailable</p>
          <p className="font-jakarta text-sm text-rose-600 mt-1">{error || "This report could not be found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ExportPdfButton
            reportId={generatedReport?.id ?? report.id}
            reportKind={generatedReport ? "generated_report" : "analysis"}
          />
          {activeShareUrl ? (
            <>
              <button
                onClick={copyShareUrl}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 font-jakarta text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Copy size={13} />
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={() => updateSharing(false)}
                disabled={sharing}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 font-jakarta text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={13} />
                Unshare
              </button>
            </>
          ) : (
            <button
              onClick={() => updateSharing(true)}
              disabled={sharing}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 font-jakarta text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Share
            </button>
          )}
          <button
            onClick={deleteReport}
            disabled={deleting}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 font-jakarta text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>

      <div className="surface-panel no-print mb-5 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="font-jakarta text-sm font-bold text-gray-900">Founder report outputs</p>
            <p className="font-jakarta text-xs text-gray-500 mt-1">
              Turn this saved analysis into a polished founder document, investor memo, or slide-ready summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { type: "detailed" as const, label: "Detailed report", icon: FileText },
              { type: "investor_memo" as const, label: "Investor memo", icon: Newspaper },
              { type: "slide_summary" as const, label: "Slide summary", icon: Layout },
            ].map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => generateReport(type)}
                disabled={Boolean(generating)}
                className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-jakarta text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {generating === type ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-jakarta text-xs text-gray-400">Share expiry</span>
          {[
            ["none", "No expiry"],
            ["7d", "7 days"],
            ["30d", "30 days"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setExpiresIn(value as ShareExpiryOption)}
              className={`h-7 px-2.5 rounded-lg border font-jakarta text-[11px] font-bold transition-colors ${
                expiresIn === value
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-black/8 bg-gray-50 text-gray-500 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {generatedReport ? (
        <GeneratedReportRenderer report={generatedReport} />
      ) : (
        <ReportRenderer report={report} />
      )}
    </div>
  );
}
