"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Crown, TrendingUp, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { PLANS, getPlanLabel, type PlanKey } from "@/lib/plans";

interface UsageSummary {
  plan: PlanKey;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  cold_dm_limit: number;
  cold_dm_used: number;
  cold_dm_remaining: number;
  brand_forge_limit: number;
  brand_forge_used: number;
  brand_forge_remaining: number;
  workspace_limit: number;
  workspaces_used: number;
  workspaces_remaining: number;
  expires_at: string | null;
}

const FREE_DEFAULTS: UsageSummary = {
  plan: "free",
  billing_cycle: null,
  monthly_limit: PLANS.free.analysesPerMonth,
  analyses_used: 0,
  analyses_remaining: PLANS.free.analysesPerMonth,
  cold_dm_limit: 2,
  cold_dm_used: 0,
  cold_dm_remaining: 2,
  brand_forge_limit: 2,
  brand_forge_used: 0,
  brand_forge_remaining: 2,
  workspace_limit: 1,
  workspaces_used: 0,
  workspaces_remaining: 1,
  expires_at: null,
};

export default function UsageWidget() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers: Record<string, string> = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const res = await fetch("/api/check-usage", { headers });
        setData(res.ok ? await res.json() : FREE_DEFAULTS);
      } catch {
        setData(FREE_DEFAULTS);
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="surface-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-3 bg-gray-100 rounded-full w-24" />
          <div className="h-5 bg-gray-100 rounded-full w-16" />
        </div>
        <div className="h-2 bg-gray-100 rounded-full w-full mb-3" />
        <div className="flex justify-between">
          <div className="h-3 bg-gray-100 rounded-full w-20" />
          <div className="h-3 bg-gray-100 rounded-full w-16" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isFree = data.plan === "free";
  const pct = Math.min(100, Math.round((data.analyses_used / data.monthly_limit) * 100));
  const nearLimit = pct >= 80;
  const atLimit = pct >= 100;
  const cycleLabel = data.billing_cycle === "yearly" ? "Annual" : data.billing_cycle === "monthly" ? "Monthly" : null;
  const secondaryUsage = [
    { label: "ColdDM", used: data.cold_dm_used, limit: data.cold_dm_limit },
    { label: "BrandForge", used: data.brand_forge_used, limit: data.brand_forge_limit },
    { label: "Workspaces", used: data.workspaces_used, limit: data.workspace_limit },
  ];

  const expiryLabel = data.expires_at
    ? new Date(data.expires_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const barColor = atLimit
    ? "from-rose-500 to-rose-600"
    : nearLimit
    ? "from-amber-400 to-orange-500"
    : isFree
    ? "from-blue-500 to-violet-500"
    : "from-emerald-400 to-emerald-500";

  return (
    <div className={`rounded-xl border bg-[#fffefa] p-6 shadow-sm ${isFree ? "border-black/8" : "border-emerald-200/70"}`}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          {isFree ? (
            <div className="w-8 h-8 rounded-lg bg-gray-100 border border-black/6 flex items-center justify-center">
              <TrendingUp size={14} className="text-gray-500" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Crown size={14} className="text-emerald-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-jakarta text-sm font-bold text-gray-900">{isFree ? "Starter Plan" : `${getPlanLabel(data.plan)} Plan`}</p>
              {!isFree && (
                <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="font-mono text-[9px] font-semibold text-emerald-700">Active</span>
                </span>
              )}
            </div>
            {cycleLabel && <p className="font-jakarta text-xs text-gray-400">{cycleLabel} billing</p>}
          </div>
        </div>

        {isFree && (
          <Link href="/payment?plan=founder">
            <button className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 py-1.5 font-jakarta text-xs font-semibold text-white shadow-sm shadow-emerald-900/15 transition-all hover:bg-emerald-800 hover:shadow-md">
              <Zap size={10} />
              Upgrade
            </button>
          </Link>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="font-jakarta text-2xl font-bold text-gray-900">{data.analyses_used}</span>
            <span className="font-jakarta text-sm text-gray-400"> / {data.monthly_limit}</span>
          </div>
          <span className={`font-jakarta text-xs font-bold ${atLimit ? "text-rose-500" : nearLimit ? "text-amber-500" : "text-gray-500"}`}>{pct}% used</span>
        </div>

        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full bg-gradient-to-r ${barColor}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
        </div>

        <div className="flex justify-between mt-2">
          <p className="font-jakarta text-xs text-gray-400">{data.analyses_remaining} remaining this month</p>
          {atLimit && (
            <p className="font-jakarta text-xs text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle size={10} /> Limit reached
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {secondaryUsage.map((item) => (
          <div key={item.label} className="surface-inset px-3 py-2.5">
            <p className="metadata-text truncate">{item.label}</p>
            <p className="font-jakarta text-xs text-gray-700 mt-1">
              <span className="font-jakarta font-bold text-gray-900">{item.used}</span> / {item.limit}
            </p>
          </div>
        ))}
      </div>

      {isFree && nearLimit && !atLimit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="font-jakarta text-xs text-amber-700 mb-2">You&apos;re approaching your free limit.</p>
          <Link href="/payment?plan=founder">
            <button className="font-jakarta text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors">Upgrade to Founder - 50 analyses/month</button>
          </Link>
        </div>
      )}

      {isFree && atLimit && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="font-jakarta text-xs text-rose-700 mb-2">You&apos;ve used all {data.monthly_limit} free analyses this month.</p>
          <Link href="/payment?plan=founder">
            <button className="font-jakarta text-xs font-bold text-rose-700 hover:text-rose-900 transition-colors">Upgrade to Founder - $5/mo, 50 analyses</button>
          </Link>
        </div>
      )}

      {!isFree && expiryLabel && (
        <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-emerald-500" />
          <p className="font-jakarta text-xs text-gray-400">Renews {expiryLabel}</p>
        </div>
      )}
    </div>
  );
}
