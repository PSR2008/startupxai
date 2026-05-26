/**
 * src/components/app/SubscriptionStatusCard.tsx
 * ─────────────────────────────────────────────────────────────
 * NEW FILE — create at this exact path.
 *
 * Shows detailed subscription information:
 *   - Active / Inactive state with animated indicator
 *   - Renewal date
 *   - Billing cycle (Monthly / Annual)
 *   - Plan label
 *
 * Used as the second card in the dashboard subscription section.
 * Shares data fetch with UsageWidget — reads from /api/subscription-status.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, CalendarDays, RefreshCw, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PlanKey } from "@/lib/plans";

interface SubStatus {
  plan: PlanKey;
  label: string;
  billingCycle: "monthly" | "yearly" | null;
  active: boolean;
  expiresAt: string | null;
  isExpired: boolean;
}

const FREE_DEFAULTS: SubStatus = {
  plan: "free",
  label: "Free",
  billingCycle: null,
  active: false,
  expiresAt: null,
  isExpired: false,
};

export default function SubscriptionStatusCard() {
  const [data, setData] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const res = await fetch("/api/subscription-status", { headers });
        if (res.ok) {
          setData(await res.json());
        } else {
          setData(FREE_DEFAULTS);
        }
      } catch {
        setData(FREE_DEFAULTS);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-3 bg-gray-100 rounded-full w-32 mb-4" />
        <div className="h-6 bg-gray-100 rounded-full w-24 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded-full w-40" />
          <div className="h-3 bg-gray-100 rounded-full w-28" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isFree     = data.plan === "free";
  const isFounder  = data.plan === "founder";
  const cycleLabel = data.billingCycle === "yearly" ? "Annual" : data.billingCycle === "monthly" ? "Monthly" : "—";

  const expiryLabel = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  return (
    <div
      className={`rounded-2xl border bg-white p-6 shadow-sm ${
        isFounder && data.active
          ? "border-emerald-200/60"
          : "border-black/6"
      }`}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-5">
        <Shield
          size={14}
          className={isFounder && data.active ? "text-emerald-600" : "text-gray-400"}
        />
        <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-widest">
          Subscription Status
        </p>
      </div>

      {/* Active / Inactive pill */}
      <div className="flex items-center gap-2.5 mb-5">
        <motion.div
          animate={
            isFounder && data.active
              ? { scale: [1, 1.2, 1] }
              : {}
          }
          transition={{ repeat: Infinity, duration: 2 }}
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isFounder && data.active
              ? "bg-emerald-500"
              : "bg-gray-300"
          }`}
        />
        <p
          className={`font-bricolage text-lg font-bold ${
            isFounder && data.active ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {isFree
            ? "Free Plan"
            : data.isExpired
            ? "Expired"
            : data.active
            ? "Active"
            : "Inactive"}
        </p>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gray-50 border border-black/6 flex items-center justify-center flex-shrink-0">
            <Shield size={10} className="text-gray-400" />
          </div>
          <div>
            <p className="font-bricolage text-xs font-bold text-gray-700">
              {data.label}
            </p>
            <p className="font-jakarta text-[11px] text-gray-400">Current plan</p>
          </div>
        </div>

        {isFounder && (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gray-50 border border-black/6 flex items-center justify-center flex-shrink-0">
              <RefreshCw size={10} className="text-gray-400" />
            </div>
            <div>
              <p className="font-bricolage text-xs font-bold text-gray-700">
                {cycleLabel}
              </p>
              <p className="font-jakarta text-[11px] text-gray-400">Billing cycle</p>
            </div>
          </div>
        )}

        {expiryLabel && isFounder && (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gray-50 border border-black/6 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={10} className="text-gray-400" />
            </div>
            <div>
              <p className="font-bricolage text-xs font-bold text-gray-700">
                {data.isExpired ? `Expired ${expiryLabel}` : `Renews ${expiryLabel}`}
              </p>
              <p className="font-jakarta text-[11px] text-gray-400">
                {data.isExpired ? "Plan expired" : "Next billing date"}
              </p>
            </div>
          </div>
        )}

        {isFree && (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gray-50 border border-black/6 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={10} className="text-gray-400" />
            </div>
            <div>
              <p className="font-bricolage text-xs font-bold text-gray-700">
                Resets monthly
              </p>
              <p className="font-jakarta text-[11px] text-gray-400">15 analyses per month</p>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade CTA for free users */}
      {isFree && (
        <div className="mt-5 pt-4 border-t border-black/5">
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bricolage text-xs font-bold shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/30 transition-all">
              <Zap size={11} />
              Upgrade to Founder — $5/mo
            </button>
          </Link>
          <p className="font-jakarta text-[10px] text-gray-400 text-center mt-2">
            500 analyses/month · all engines · PDF exports
          </p>
        </div>
      )}

      {/* Switch to annual for monthly Founder */}
      {isFounder && data.active && data.billingCycle === "monthly" && (
        <div className="mt-5 pt-4 border-t border-black/5">
          <Link href="/payment?plan=founder&billing=yearly">
            <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-200 text-emerald-700 font-bricolage text-xs font-bold hover:bg-emerald-50 transition-all">
              <RefreshCw size={10} />
              Switch to Annual — Save $11/year
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
