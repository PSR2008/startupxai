"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Shield, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { PLANS, type PlanKey } from "@/lib/plans";

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
  label: "Starter",
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
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const res = await fetch("/api/subscription-status", { headers });
        setData(res.ok ? await res.json() : FREE_DEFAULTS);
      } catch {
        setData(FREE_DEFAULTS);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="surface-panel p-6">
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

  const isFree = data.plan === "free";
  const isPaid = data.plan !== "free";
  const cycleLabel = data.billingCycle === "yearly" ? "Annual" : data.billingCycle === "monthly" ? "Monthly" : "-";

  const expiryLabel = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className={`rounded-xl border bg-[#fffefa] p-6 shadow-sm ${isPaid && data.active ? "border-emerald-200/70" : "border-black/8"}`}>
      <div className="flex items-center gap-2 mb-5">
        <Shield size={14} className={isPaid && data.active ? "text-emerald-600" : "text-gray-400"} />
        <p className="font-jakarta text-xs font-semibold text-gray-500">Subscription Status</p>
      </div>

      <div className="flex items-center gap-2.5 mb-5">
        <motion.div animate={isPaid && data.active ? { opacity: [0.7, 1, 0.7] } : {}} transition={{ repeat: Infinity, duration: 3 }} className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPaid && data.active ? "bg-emerald-500" : "bg-gray-300"}`} />
        <p className={`font-bricolage text-lg font-bold ${isPaid && data.active ? "text-gray-900" : "text-gray-500"}`}>
          {isFree ? "Starter Plan" : data.isExpired ? "Expired" : data.active ? "Active" : "Inactive"}
        </p>
      </div>

      <div className="space-y-3">
        <InfoRow icon={<Shield size={10} className="text-gray-400" />} title={data.label} subtitle="Current plan" />

        {isPaid && <InfoRow icon={<Shield size={10} className="text-gray-400" />} title={cycleLabel} subtitle="Billing cycle" />}

        {expiryLabel && isPaid && (
          <InfoRow icon={<CalendarDays size={10} className="text-gray-400" />} title={data.isExpired ? `Expired ${expiryLabel}` : `Renews ${expiryLabel}`} subtitle={data.isExpired ? "Plan expired" : "Next billing date"} />
        )}

        {isFree && <InfoRow icon={<CalendarDays size={10} className="text-gray-400" />} title="Resets monthly" subtitle={`${PLANS.free.analysesPerMonth} analyses per month`} />}
      </div>

      {isFree && (
        <div className="mt-5 pt-4 border-t border-black/5">
          <Link href="/payment?plan=founder&billing=monthly">
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 py-2.5 font-jakarta text-xs font-semibold text-white shadow-sm shadow-emerald-900/15 transition-all hover:bg-emerald-800 hover:shadow-md">
              <Zap size={11} />
              Upgrade to Founder - $5/mo
            </button>
          </Link>
          <p className="font-jakarta text-[10px] text-gray-400 text-center mt-2">50 analyses/month, all engines, PDF exports</p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-black/8 bg-[#f8f6f0]">{icon}</div>
      <div>
        <p className="font-bricolage text-xs font-bold text-gray-700">{title}</p>
        <p className="font-jakarta text-[11px] text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}
