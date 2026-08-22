"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import Button from "./Button";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

export default function ExportPdfButton({
  label = "Export PDF",
  reportId,
  reportKind = "analysis",
}: {
  label?: string;
  reportId?: string;
  reportKind?: "analysis" | "generated_report";
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ reportId, reportKind }),
      });

      if (res.ok) {
        window.print();
        return;
      }

      window.location.href = "/payment?plan=founder";
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} icon={<FileDown size={14} />}>
      {loading ? "Checking..." : label}
    </Button>
  );
}
