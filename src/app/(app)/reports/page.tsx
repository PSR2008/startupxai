"use client";

import { FileText } from "lucide-react";
import RecentReports from "@/components/app/RecentReports";

export default function ReportsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={18} className="text-emerald-600" />
          <h1 className="font-jakarta text-3xl font-bold text-gray-900">Reports</h1>
        </div>
        <p className="font-jakarta text-sm text-gray-500">
          Your saved analysis history across every StartupX AI engine.
        </p>
      </div>

      <RecentReports limit={20} />
    </div>
  );
}
