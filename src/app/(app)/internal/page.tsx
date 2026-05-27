"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  checks: Record<string, boolean>;
}

const labels: Record<string, string> = {
  anthropic: "Anthropic API key",
  supabaseUrl: "Supabase URL",
  supabaseAnonKey: "Supabase anon key",
  supabaseServiceRole: "Supabase service role",
  razorpayKeyId: "Razorpay key ID",
  razorpayKeySecret: "Razorpay key secret",
  razorpayWebhookSecret: "Razorpay webhook secret",
};

export default function InternalPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) setHealth(await res.json());
      } finally {
        setLoading(false);
      }
    }

    loadHealth();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={18} className="text-emerald-600" />
          <h1 className="font-bricolage text-3xl font-bold text-gray-900">Internal Diagnostics</h1>
        </div>
        <p className="font-jakarta text-sm text-gray-500">
          Quick production readiness check for core StartupX AI services.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-black/6 bg-white p-8 shadow-sm flex items-center gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-jakarta text-sm">Checking services...</span>
        </div>
      ) : !health ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <p className="font-bricolage text-sm font-bold text-rose-700">Health check unavailable</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
            <p className="font-bricolage text-sm font-bold text-gray-900">{health.service}</p>
            <p className="font-jakarta text-xs text-gray-400 mt-1">
              {health.environment} - v{health.version} - {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(health.checks).map(([key, ok]) => (
              <div key={key} className="rounded-xl border border-black/6 bg-white p-4 flex items-center justify-between gap-3">
                <span className="font-jakarta text-sm text-gray-700">{labels[key] ?? key}</span>
                {ok ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-jakarta text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={12} /> Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-jakarta text-xs font-bold text-rose-700">
                    <XCircle size={12} /> Missing
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
