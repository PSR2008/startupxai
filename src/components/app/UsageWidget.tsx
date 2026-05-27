"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Crown, TrendingUp, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PlanKey } from "@/lib/plans";

interface UsageSummary {
  plan: PlanKey;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  expires_at: string | null;
}

const FREE_DEFAULTS: UsageSummary = {
  plan: "free",
  billing_cycle: null,
  monthly_limit: 15,
  analyses_used: 0,
  analyses_remaining: 15,
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
      <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm animate-pulse">
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
    <div className={`rounded-2xl border bg-white p-6 shadow-sm ${isFree ? "border-black/6" : "border-emerald-200/60"}`}>
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
              <p className="font-bricolage text-sm font-bold text-gray-900">{isFree ? "Free Plan" : "Founder Plan"}</p>
              {!isFree && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="font-bricolage text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Active</span>
                </span>
              )}
            </div>
            {cycleLabel && <p className="font-jakarta text-xs text-gray-400">{cycleLabel} billing</p>}
          </div>
        </div>

        {isFree && (
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bricolage text-xs font-bold shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/30 transition-all whitespace-nowrap">
              <Zap size={10} />
              Upgrade
            </button>
          </Link>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="font-bricolage text-2xl font-bold text-gray-900">{data.analyses_used}</span>
            <span className="font-jakarta text-sm text-gray-400"> / {data.monthly_limit}</span>
          </div>
          <span className={`font-bricolage text-xs font-bold ${atLimit ? "text-rose-500" : nearLimit ? "text-amber-500" : "text-gray-500"}`}>{pct}% used</span>
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

      {isFree && nearLimit && !atLimit && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="font-jakarta text-xs text-amber-700 mb-2">You&apos;re approaching your free limit.</p>
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="font-bricolage text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors">Upgrade to Founder - 500 analyses/month</button>
          </Link>
        </div>
      )}

      {isFree && atLimit && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200">
          <p className="font-jakarta text-xs text-rose-700 mb-2">You&apos;ve used all {data.monthly_limit} free analyses this month.</p>
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="font-bricolage text-xs font-bold text-rose-700 hover:text-rose-900 transition-colors">Upgrade to Founder - $5/mo, 500 analyses</button>
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
