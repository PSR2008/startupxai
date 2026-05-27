"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  CreditCard,
  Crown,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCircle,
  Zap,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { PLANS, getPlanLabel, type PlanKey } from "@/lib/plans";

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

interface PaymentRecord {
  id: string;
  plan: string;
  billing_cycle: string;
  amount: number | null;
  currency: string;
  status: string;
  created_at: string;
  razorpay_payment_id: string;
}

interface FounderProfile {
  startup_idea: string;
  product_summary: string;
  target_audience: string;
  industry?: string | null;
  founder_stage?: string | null;
  region?: string | null;
  primary_goal?: string | null;
}

const FREE_USAGE: UsageSummary = {
  plan: "free",
  billing_cycle: null,
  monthly_limit: PLANS.free.analysesPerMonth,
  analyses_used: 0,
  analyses_remaining: PLANS.free.analysesPerMonth,
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
  const [founderProfile, setFounderProfile] = useState<FounderProfile | null>(null);
  const [usage, setUsage] = useState<UsageSummary>(FREE_USAGE);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [securityStatus, setSecurityStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [securityMessage, setSecurityMessage] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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

        const authHeaders = { Authorization: `Bearer ${session.access_token}` };
        const [usageRes, billingRes, founderRes] = await Promise.all([
          fetch("/api/check-usage", { headers: authHeaders }),
          fetch("/api/billing-history", { headers: authHeaders }),
          fetch("/api/founder-profile", { headers: authHeaders }),
        ]);

        if (usageRes.ok) setUsage(await usageRes.json());
        if (billingRes.ok) {
          const billingData = await billingRes.json();
          setPayments(billingData.payments ?? []);
        }
        if (founderRes.ok) {
          const founderData = await founderRes.json();
          setFounderProfile(founderData.profile ?? null);
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

  const handlePasswordChange = async () => {
    setSecurityMessage("");

    if (newPassword.length < 8) {
      setSecurityStatus("error");
      setSecurityMessage("Password must be at least 8 characters.");
      return;
    }

    setSecurityStatus("loading");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setSecurityStatus("success");
      setSecurityMessage("Password updated successfully.");
    } catch (err) {
      setSecurityStatus("error");
      setSecurityMessage(err instanceof Error ? err.message : "Unable to update password.");
    }
  };

  const handleResendConfirmation = async () => {
    if (!profile?.email) return;

    setResendStatus("loading");
    setSecurityMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: profile.email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;

      setResendStatus("success");
      setSecurityMessage("Confirmation email sent.");
    } catch (err) {
      setResendStatus("error");
      setSecurityMessage(err instanceof Error ? err.message : "Unable to resend confirmation email.");
    }
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

  const isPaid = usage.plan !== "free";
  const planExpiry = usage.expires_at ? formatDate(usage.expires_at) : "No expiry";
  const securityIsError = securityStatus === "error" || resendStatus === "error";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
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

      <div className="space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Compass size={17} className="text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bricolage text-sm font-bold text-gray-900">Founder context</p>
                {founderProfile ? (
                  <>
                    <p className="font-bricolage text-lg font-bold text-gray-900 mt-1 break-words">{founderProfile.startup_idea}</p>
                    <p className="font-jakarta text-sm text-gray-500 mt-1 max-w-3xl">{founderProfile.product_summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[founderProfile.industry, founderProfile.founder_stage, founderProfile.region, founderProfile.primary_goal]
                        .filter(Boolean)
                        .map((item) => (
                          <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-jakarta text-xs text-emerald-700">
                            {item}
                          </span>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="font-jakarta text-sm text-gray-500 mt-1">Founder Setup is not complete yet.</p>
                )}
              </div>
            </div>
            <Link href="/onboarding" className="h-9 px-3.5 rounded-xl border border-black/8 bg-gray-50 text-gray-700 font-bricolage text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white transition-colors w-fit flex-shrink-0">
              <Sparkles size={13} />
              {founderProfile ? "Edit setup" : "Complete setup"}
            </Link>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm"
          >
            <div className="flex items-start gap-4 mb-7">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <UserCircle size={28} className="text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bricolage text-xl font-bold text-gray-900 truncate">{profile.email}</p>
                <p className="font-jakarta text-sm text-gray-400">StartupX AI account</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard icon={<Mail size={16} />} label="Email" value={profile.email} />
              <InfoCard
                icon={<ShieldCheck size={16} />}
                label="Email status"
                value={profile.emailConfirmedAt ? "Confirmed" : "Confirmation pending"}
                iconClassName={profile.emailConfirmedAt ? "text-emerald-600" : "text-amber-500"}
              />
              <InfoCard icon={<CalendarDays size={16} />} label="Joined" value={formatDate(profile.createdAt)} />
              <InfoCard icon={<Crown size={16} />} label="Current plan" value={getPlanLabel(usage.plan)} iconClassName={isPaid ? "text-emerald-600" : "text-gray-400"} />
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start gap-2 mb-5">
              <ShieldCheck size={16} className="text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bricolage text-sm font-bold text-gray-900">Account security</p>
                <p className="font-jakarta text-xs text-gray-400">
                  Manage password and email verification.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound size={15} className="text-gray-500" />
                  <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Change password</p>
                </div>
                <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (securityStatus === "error") setSecurityStatus("idle");
                    }}
                    placeholder="New password"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3.5 font-jakarta text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500"
                  />
                  <button
                    onClick={handlePasswordChange}
                    disabled={securityStatus === "loading"}
                    className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-bricolage text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {securityStatus === "loading" ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-black/6 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail size={15} className="text-gray-500" />
                  <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Email confirmation</p>
                </div>
                <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row sm:items-start 2xl:items-center justify-between gap-3">
                  <p className="font-jakarta text-sm text-gray-600">
                    {profile.emailConfirmedAt ? "Your email is confirmed." : "Confirmation is still pending."}
                  </p>
                  <button
                    onClick={handleResendConfirmation}
                    disabled={Boolean(profile.emailConfirmedAt) || resendStatus === "loading"}
                    className="h-10 px-4 rounded-xl border border-black/10 bg-white text-gray-700 font-bricolage text-xs font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 flex-shrink-0"
                  >
                    <RefreshCw size={13} className={resendStatus === "loading" ? "animate-spin" : ""} />
                    Resend
                  </button>
                </div>
              </div>
            </div>

            {securityMessage && (
              <div className={`mt-4 rounded-xl border px-4 py-3 ${securityIsError ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                <p className={`font-jakarta text-sm ${securityIsError ? "text-rose-700" : "text-emerald-700"}`}>
                  {securityMessage}
                </p>
              </div>
            )}
          </motion.section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11 }}
            className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
          >
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
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
          >
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
                <span className="font-jakarta text-sm text-emerald-700">{isPaid ? "Manage plan" : "Upgrade to Founder"}</span>
                <Zap size={14} className="text-emerald-600" />
              </Link>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-emerald-600" />
              <div>
                <p className="font-bricolage text-sm font-bold text-gray-900">Billing history</p>
                <p className="font-jakarta text-xs text-gray-400">
                  {isPaid ? `${getPlanLabel(usage.plan)} ${usage.billing_cycle ?? "monthly"} plan renews/expires on ${planExpiry}.` : "No paid plan is active yet."}
                </p>
              </div>
            </div>
            <Link href="/payment?plan=founder&billing=monthly" className="h-9 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bricolage text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors w-fit">
              <Crown size={13} />
              {isPaid ? "Manage plan" : "Upgrade"}
            </Link>
          </div>

          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 bg-gray-50 p-5">
              <ReceiptText size={18} className="text-gray-300 mb-3" />
              <p className="font-bricolage text-sm font-bold text-gray-800 mb-1">No payments yet</p>
              <p className="font-jakarta text-xs text-gray-400">Successful paid plan payments will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-black/6">
                    {["Date", "Plan", "Billing", "Amount", "Status"].map((heading) => (
                      <th key={heading} className="py-3 font-bricolage text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-black/5 last:border-0">
                      <td className="py-3 font-jakarta text-sm text-gray-600">{formatDate(payment.created_at)}</td>
                      <td className="py-3 font-jakarta text-sm text-gray-700 capitalize">{payment.plan}</td>
                      <td className="py-3 font-jakarta text-sm text-gray-500 capitalize">{payment.billing_cycle}</td>
                      <td className="py-3 font-bricolage text-sm font-bold text-gray-900">
                        {payment.currency} {((payment.amount ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-jakarta text-[11px] font-bold text-emerald-700 capitalize">
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  iconClassName = "text-gray-400",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-black/6 bg-gray-50 p-4 min-w-0">
      <div className={iconClassName}>{icon}</div>
      <p className="font-bricolage text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 mt-3">{label}</p>
      <p className="font-jakarta text-sm text-gray-800 break-words">{value}</p>
    </div>
  );
}
