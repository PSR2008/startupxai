"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Crown,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCircle,
  Zap,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { PlanKey } from "@/lib/plans";

interface ProfileState {
  email: string;
  createdAt: string | null;
  emailConfirmedAt: string | null;
}

interface UsageSummary {
  plan: PlanKey;
  billing_cycle: string | null;
  monthly_limit: number;
  analyses_used: number;
  analyses_remaining: number;
  expires_at: string | null;
}

const FREE_USAGE: UsageSummary = {
  plan: "free",
  billing_cycle: null,
  monthly_limit: 15,
  analyses_used: 0,
  analyses_remaining: 15,
  expires_at: null,
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [usage, setUsage] = useState<UsageSummary>(FREE_USAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/signin");
          return;
        }

        setProfile({
          email: session.user.email ?? "No email",
          createdAt: session.user.created_at ?? null,
          emailConfirmedAt: session.user.email_confirmed_at ?? null,
        });

        const res = await fetch("/api/check-usage", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.ok) {
          setUsage(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const usagePct = useMemo(
    () => Math.min(100, Math.round((usage.analyses_used / usage.monthly_limit) * 100)),
    [usage.analyses_used, usage.monthly_limit]
  );

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-black/6 bg-white p-8 shadow-sm animate-pulse">
          <div className="h-7 w-40 bg-gray-100 rounded-full mb-4" />
          <div className="h-4 w-72 bg-gray-100 rounded-full" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isFounder = usage.plan === "founder";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">Profile</h1>
            <p className="font-jakarta text-sm text-gray-500">
              Manage your account, plan, and usage from one place.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="h-10 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 font-bricolage text-xs font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors w-fit"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm"
        >
          <div className="flex items-start gap-4 mb-7">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <UserCircle size={28} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bricolage text-xl font-bold text-gray-900 truncate">{profile.email}</p>
              <p className="font-jakarta text-sm text-gray-400">StartupX AI account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
              <Mail size={16} className="text-gray-400 mb-3" />
              <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</p>
              <p className="font-jakarta text-sm text-gray-800 break-all">{profile.email}</p>
            </div>
            <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
              <ShieldCheck size={16} className={profile.emailConfirmedAt ? "text-emerald-600 mb-3" : "text-amber-500 mb-3"} />
              <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email status</p>
              <p className="font-jakarta text-sm text-gray-800">
                {profile.emailConfirmedAt ? "Confirmed" : "Confirmation pending"}
              </p>
            </div>
            <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
              <CalendarDays size={16} className="text-gray-400 mb-3" />
              <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Joined</p>
              <p className="font-jakarta text-sm text-gray-800">{formatDate(profile.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
              <Crown size={16} className={isFounder ? "text-emerald-600 mb-3" : "text-gray-400 mb-3"} />
              <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Current plan</p>
              <p className="font-jakarta text-sm text-gray-800">{isFounder ? "Founder" : "Free"}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-600" />
                <p className="font-bricolage text-sm font-bold text-gray-900">Monthly usage</p>
              </div>
              <span className="font-bricolage text-xs font-bold text-gray-500">{usagePct}%</span>
            </div>
            <div className="mb-2">
              <span className="font-bricolage text-3xl font-bold text-gray-900">{usage.analyses_used}</span>
              <span className="font-jakarta text-sm text-gray-400"> / {usage.monthly_limit}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${usagePct}%` }} />
            </div>
            <p className="font-jakarta text-xs text-gray-400">
              {usage.analyses_remaining} analyses remaining this month.
            </p>
          </div>

          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-amber-500" />
              <p className="font-bricolage text-sm font-bold text-gray-900">Quick actions</p>
            </div>
            <div className="space-y-2">
              <Link href="/dashboard" className="flex items-center justify-between rounded-xl border border-black/6 bg-gray-50 px-4 py-3 hover:bg-white transition-colors">
                <span className="font-jakarta text-sm text-gray-700">Open dashboard</span>
                <ArrowRight size={14} className="text-gray-400" />
              </Link>
              <Link href="/payment?plan=founder&billing=monthly" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 hover:bg-emerald-100 transition-colors">
                <span className="font-jakarta text-sm text-emerald-700">{isFounder ? "Manage Founder plan" : "Upgrade to Founder"}</span>
                <Zap size={14} className="text-emerald-600" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
