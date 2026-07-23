"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock, CheckCircle2, Shield, RefreshCw, Zap, ArrowLeft, Star, Globe, BarChart3,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { PLANS, isPaidPlanKey, type PaidPlanKey } from "@/lib/plans";

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string; amount: number; currency: string; name: string;
      description?: string; order_id: string;
      prefill?: { name?: string; email?: string; contact?: string };
      notes?: Record<string, string>;
      theme?: { color?: string };
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
      modal?: { ondismiss?: () => void };
    }) => { open: () => void };
  }
}

const plans = {
  founder: {
    name: PLANS.founder.label,
    price: PLANS.founder.monthlyPrice,
    annualPrice: PLANS.founder.yearlyPrice,
    desc: "For solo founders validating seriously",
    features: [`${PLANS.founder.analysesPerMonth} analyses/month`, "All intelligence engines", "25 ColdDM generations", "25 BrandForge generations", "Investor memo + slide summary", "PDF exports", "Saved analysis history", "Email support"],
  },
  growth: {
    name: PLANS.growth.label,
    price: PLANS.growth.monthlyPrice,
    annualPrice: PLANS.growth.yearlyPrice,
    desc: "For founders iterating regularly",
    features: [`${PLANS.growth.analysesPerMonth} analyses/month`, "All intelligence engines", "100 ColdDM generations", "100 BrandForge generations", "Investor memo + slide summary", "PDF exports", "Shareable reports", "Up to 3 workspaces", "Priority support"],
  },
  scale: {
    name: PLANS.scale.label,
    price: PLANS.scale.monthlyPrice,
    annualPrice: PLANS.scale.yearlyPrice,
    desc: "For teams running more decisions",
    features: [`${PLANS.scale.analysesPerMonth} analyses/month`, "All intelligence engines", "300 ColdDM generations", "300 BrandForge generations", "Investor memo + slide summary", "PDF exports", "Shareable reports", "Team-ready workspaces", "Priority processing"],
  },
} as const;

const founderHighlights = [
  { icon: BarChart3, label: "Paid usage tiers", detail: "50, 150, or 400 analyses/month" },
  { icon: Globe, label: "USD billing", detail: "Clear international pricing" },
  { icon: Shield, label: "Private dashboard", detail: "Usage and plan tied to your account" },
];

type BillingCycle = "monthly" | "annual";
type PayStatus = "idle" | "loading" | "success" | "error";

function PaymentPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawPlan = searchParams.get("plan");
  const planParam: PaidPlanKey = isPaidPlanKey(rawPlan) ? rawPlan : "founder";
  const plan = plans[planParam] || plans.founder;

  const billingParam = searchParams.get("billing");
  const initialBilling: BillingCycle =
    billingParam === "annual" || billingParam === "yearly" ? "annual" : "monthly";
  const [billing, setBilling] = useState<BillingCycle>(initialBilling);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [status, setStatus] = useState<PayStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const price = billing === "annual" ? plan.annualPrice : plan.price;
  const annualSavings = plan.price * 12 - plan.annualPrice;

  const selectPlan = (nextPlan: PaidPlanKey) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("plan", nextPlan);
    next.set("billing", billing);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const handlePay = async () => {
    if (!name.trim() || !email.trim()) {
      setErrorMsg("Please enter your full name and email.");
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");
      setErrorMsg("");

      if (!window.Razorpay) throw new Error("Razorpay SDK failed to load.");

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = {};
      if (session?.access_token) {
        authHeaders.Authorization = `Bearer ${session.access_token}`;
      }

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ plan: planParam, billing, coupon }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData?.success || !orderData?.order) {
        throw new Error(orderData?.message || "Failed to create Razorpay order.");
      }

      const options = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "StartupX AI",
        description: `${plan.name} Plan (${billing})`,
        order_id: orderData.order.id,
        prefill: { name, email },
        notes: { plan: plan.name, billing },
        theme: { color: "#10b981" },
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          try {
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeaders },
              body: JSON.stringify({
                ...response,
                plan: planParam,
                billing,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.success) throw new Error(verifyData?.message || "Payment verification failed.");
            setStatus("success");
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Payment verification failed.");
            setStatus("error");
          }
        },
        modal: { ondismiss: () => { if (status !== "success") setStatus("idle"); } },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to start payment.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" />
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
              <p className="font-jakarta text-gray-500">
                Welcome to StartupX AI{" "}
                <span className="text-emerald-600 font-semibold">{plan.name}</span>.
                Your payment was received successfully.
              </p>
            </div>
            <Link href="/profile">
              <button className="w-full h-12 rounded-xl font-bricolage text-sm font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 transition-all">
                View plan status
              </button>
            </Link>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="min-h-screen bg-[var(--color-bg-primary)] p-6 lg:p-10">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 font-jakarta text-sm mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>

          {/* Page header */}
          <div className="mb-8">
            <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-1">
              Complete your purchase
            </h1>
            <p className="font-jakarta text-sm text-gray-500">
              Upgrading to{" "}
              <span className="text-emerald-600 font-semibold">{plan.name} Plan</span>{" "}
              unlocks higher usage and founder-grade workflow tools.
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-2xl border border-black/6 bg-white shadow-sm">
            {[
              { icon: Shield, label: "256-bit SSL encryption" },
              { icon: Lock, label: "Secured by Razorpay" },
              { icon: RefreshCw, label: "Cancel anytime" },
              { icon: Zap, label: "Instant activation" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={14} className="text-emerald-600" />
                <span className="font-jakarta text-xs text-gray-600">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Left: form */}
            <div className="rounded-2xl border border-black/6 bg-white p-8 space-y-6 shadow-sm">
              {/* Billing toggle */}
              <div>
                <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Select Plan
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(plans) as PaidPlanKey[]).map((key) => {
                    const option = plans[key];
                    const active = key === planParam;
                    return (
                      <button
                        key={key}
                        onClick={() => selectPlan(key)}
                        className={`text-left rounded-xl border p-4 transition-all ${
                          active
                            ? "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100"
                            : "border-black/8 bg-gray-50 hover:border-black/14 hover:bg-white"
                        }`}
                      >
                        <p className={`font-bricolage text-sm font-bold ${active ? "text-emerald-700" : "text-gray-800"}`}>
                          {option.name}
                        </p>
                        <p className="font-jakarta text-xs text-gray-400 mt-1">
                          ${option.price}/mo · {option.features[0]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Billing Cycle
                </p>
                <div className="flex gap-3">
                  {(["monthly", "annual"] as BillingCycle[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setBilling(c)}
                      className={`flex-1 py-3 px-4 rounded-xl border font-bricolage text-sm font-semibold transition-all ${
                        billing === c
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100"
                          : "border-black/8 bg-gray-50 text-gray-500 hover:border-black/14 hover:bg-white"
                      }`}
                    >
                      {c === "monthly" ? "Monthly" : "Annual"}
                      {c === "annual" && (
                        <span className="ml-2 text-xs font-bold text-emerald-600">Save ${annualSavings}/year</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="font-jakarta text-xs text-gray-400 mt-2">
                  {`Annual billing is $${plan.annualPrice}/year. Monthly billing is $${plan.price}/month. Prices are shown in USD.`}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {founderHighlights.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="rounded-xl border border-black/6 bg-gray-50 p-4">
                    <Icon size={15} className="text-emerald-600 mb-2" />
                    <p className="font-bricolage text-xs font-bold text-gray-800">{label}</p>
                    <p className="font-jakarta text-[11px] text-gray-400 mt-1 leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>

              {/* Account details */}
              <div className="space-y-4">
                <p className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide pb-2 border-b border-black/5">
                  Account Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full h-11 px-3.5 rounded-xl bg-white text-gray-900 border border-black/10 text-sm font-jakarta placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 hover:border-black/18 transition-all"
                    />
                  </div>
                  <div>
                    <label className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1.5">
                      Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@startup.com"
                      className="w-full h-11 px-3.5 rounded-xl bg-white text-gray-900 border border-black/10 text-sm font-jakarta placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 hover:border-black/18 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Coupon */}
              <div>
                <label className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1.5">
                  Coupon Code{" "}
                  <span className="text-gray-400 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 h-11 px-3.5 rounded-xl bg-white text-gray-900 border border-black/10 text-sm font-jakarta placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
                  />
                </div>
                {coupon.trim() && (
                  <p className="font-jakarta text-xs text-gray-400 mt-1.5">
                    If valid, your coupon will be applied securely at checkout.
                  </p>
                )}
              </div>

              {status === "error" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="font-jakarta text-sm text-rose-700">{errorMsg}</p>
                </div>
              )}

              {/* Pay button */}
              <button
                onClick={handlePay}
                disabled={status === "loading"}
                className="w-full h-12 py-3.5 rounded-xl font-bricolage text-base font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 active:translate-y-0 shadow-md shadow-emerald-500/20"
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/6 border-t-white rounded-full animate-spin" />
                    Starting payment...
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    Pay ${price} with Razorpay
                  </>
                )}
              </button>

              <p className="text-center font-jakarta text-xs text-gray-400 flex items-center justify-center gap-1.5">
                <Shield size={11} /> Your payment is processed securely by Razorpay
              </p>
            </div>

            {/* Right: order summary */}
            <div className="h-fit sticky top-6 space-y-4">
              <div className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm">
                <p className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                    {plan.name} unlocks
                </p>

                {/* Plan name + stars */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bricolage text-xl font-bold text-gray-900">{plan.name} Plan</p>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="font-jakarta text-sm text-gray-500">{plan.desc}</p>
                </div>

                {/* Price display */}
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="font-bricolage text-4xl font-bold text-gray-900">${price}</span>
                  <span className="font-jakarta text-sm text-gray-400 mb-2">
                    {billing === "annual" ? "/year" : "/month"}
                  </span>
                </div>
                {billing === "annual" && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 mb-4">
                    <CheckCircle2 size={10} className="text-emerald-600" />
                    <p className="font-jakarta text-xs font-semibold text-emerald-700">
                      Save ${plan.price * 12 - plan.annualPrice}/year
                    </p>
                  </div>
                )}

                <hr className="border-black/5 my-4" />

                {/* Features */}
                <div className="space-y-2.5 mb-4">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="font-jakarta text-sm text-gray-600">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-4">
                  <p className="font-jakarta text-xs text-emerald-700 leading-relaxed">
                    Your plan activates instantly after successful payment and appears on the dashboard subscription card.
                  </p>
                </div>

                <hr className="border-black/5 my-4" />

                {/* Price breakdown */}
                <div className="space-y-2 font-jakarta text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-800">${price}</span>
                  </div>
                  <div className="flex justify-between font-bricolage font-bold text-base pt-2 border-t border-black/5">
                    <span className="text-gray-700">Total</span>
                    <span className="text-gray-900">${price}</span>
                  </div>
                </div>
              </div>

              {/* Trust signals */}
              <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
                <p className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                  You&apos;re in safe hands
                </p>
                <div className="space-y-2.5">
                  {[
                    { icon: Shield, text: "SSL encrypted transaction" },
                    { icon: RefreshCw, text: "Cancel anytime" },
                    { icon: Zap, text: "Instant plan activation" },
                    { icon: Lock, text: "Handled through Razorpay checkout" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Icon size={11} className="text-emerald-600" />
                      </div>
                      <span className="font-jakarta text-xs text-gray-500">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PaymentPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] p-6 lg:p-10">
      <div className="text-gray-400 text-sm font-bricolage">Loading payment page...</div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentPageFallback />}>
      <PaymentPageContent />
    </Suspense>
  );
}

