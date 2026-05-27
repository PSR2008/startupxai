"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Link2, Loader2, Trash2, X } from "lucide-react";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import ReportRenderer, { type RenderableReport } from "@/components/app/ReportRenderer";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

interface ReportDetail extends RenderableReport {
  share_token?: string | null;
  shared_at?: string | null;
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const shareUrl = useMemo(() => {
    if (!report?.share_token || typeof window === "undefined") return "";
    return `${window.location.origin}/share/${report.share_token}`;
  }, [report?.share_token]);

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

  const updateSharing = async (share: boolean) => {
    if (!token || !report) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ share }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to update sharing");

      setReport((current) =>
        current
          ? {
              ...current,
              share_token: data.shareToken,
              shared_at: data.shareToken ? new Date().toISOString() : null,
            }
          : current
      );
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update sharing");
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

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
      <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ExportPdfButton />
          {report.share_token ? (
            <>
              <button
                onClick={copyShareUrl}
                className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-bricolage text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              >
                <Copy size={13} />
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={() => updateSharing(false)}
                disabled={sharing}
                className="h-8 px-3 rounded-lg border border-black/10 bg-white text-gray-600 font-bricolage text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <X size={13} />
                Unshare
              </button>
            </>
          ) : (
            <button
              onClick={() => updateSharing(true)}
              disabled={sharing}
              className="h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-bricolage text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {sharing ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Share
            </button>
          )}
          <button
            onClick={deleteReport}
            disabled={deleting}
            className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 font-bricolage text-xs font-bold hover:bg-rose-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>

      <ReportRenderer report={report} />
    </div>
  );
}
