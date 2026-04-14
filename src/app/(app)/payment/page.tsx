"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock, CheckCircle2, Shield, RefreshCw, Zap, ArrowLeft, Sparkles, Star,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";

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
    name: "Founder",
    price: 49,
    annualPrice: 499,
    desc: "For founders building seriously",
    features: [
      "Unlimited analyses",
      "All 6 intelligence engines",
      "ColdDM AI (unlimited)",
      "BrandForge AI (unlimited)",
      "PDF exports",
      "Priority processing",
    ],
  },
  studio: {
    name: "Studio",
    price: 1499,
    annualPrice: 11999,
    desc: "For teams moving fast",
    features: [
      "Everything in Founder",
      "3 team seats included",
      "Saved analysis history",
      "API access (soon)",
      "White-label exports",
      "Slack support channel",
    ],
  },
} as const;

type PlanKey = keyof typeof plans;
type BillingCycle = "monthly" | "annual";
type PayStatus = "idle" | "loading" | "success" | "error";

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const planParam = (searchParams.get("plan") as PlanKey) || "founder";
  const plan = plans[planParam] || plans.founder;

  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<PayStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const price = billing === "annual" ? plan.annualPrice : plan.price;
  const finalPrice = useMemo(() => Math.max(price - discount, 1), [price, discount]);

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === "FOUNDER20") {
      setCouponStatus("valid");
      setDiscount(Math.round(price * 0.2));
    } else {
      setCouponStatus("invalid");
      setDiscount(0);
    }
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

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planParam, billing }),
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
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
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[#f7f8fc]">
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
            <Link href="/dashboard">
              <button className="w-full h-12 rounded-xl font-bricolage text-sm font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 transition-all">
                Go to Dashboard →
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

      <div className="min-h-screen bg-[#f7f8fc] p-6 lg:p-10">
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
              <span className="text-emerald-600 font-semibold">{plan.name} Plan</span>
            </p>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-4 mb-8 p-4 rounded-2xl border border-black/6 bg-white shadow-sm">
            {[
              { icon: Shield, label: "256-bit SSL encryption" },
              { icon: Lock, label: "Secured by Razorpay" },
              { icon: RefreshCw, label: "7-day money back guarantee" },
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
                        <span className="ml-2 text-xs font-bold text-emerald-600">Save 20%</span>
                      )}
                    </button>
                  ))}
                </div>
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
                    onChange={(e) => { setCoupon(e.target.value); setCouponStatus("idle"); }}
                    placeholder="FOUNDER20"
                    className="flex-1 h-11 px-3.5 rounded-xl bg-white text-gray-900 border border-black/10 text-sm font-jakarta placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
                  />
                  <button
                    onClick={applyCoupon}
                    className="h-11 px-4 rounded-xl border border-black/10 font-bricolage text-xs font-semibold text-gray-600 hover:text-gray-900 hover:border-black/18 hover:bg-gray-50 transition-all"
                  >
                    Apply
                  </button>
                </div>
                {couponStatus === "valid" && (
                  <p className="font-jakarta text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={11} /> 20% discount applied!
                  </p>
                )}
                {couponStatus === "invalid" && (
                  <p className="font-jakarta text-xs text-rose-500 mt-1.5">✗ Invalid coupon code</p>
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
                className="w-full h-13 py-3.5 rounded-xl font-bricolage text-base font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 active:translate-y-0 shadow-md shadow-emerald-500/20"
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/6 border-t-white rounded-full animate-spin" />
                    Starting Payment…
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    Pay ₹{finalPrice} with Razorpay
                  </>
                )}
              </button>

              <p className="text-center font-jakarta text-xs text-gray-400 flex items-center justify-center gap-1.5">
                <Shield size={11} /> Your payment is protected by bank-grade encryption
              </p>
            </div>

            {/* Right: order summary */}
            <div className="h-fit sticky top-6 space-y-4">
              <div className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm">
                <p className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                  Order Summary
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
                  <span className="font-bricolage text-4xl font-bold text-gray-900">₹{finalPrice}</span>
                  <span className="font-jakarta text-sm text-gray-400 mb-2">
                    {billing === "annual" ? "/year" : "/month"}
                  </span>
                </div>
                {billing === "annual" && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 mb-4">
                    <Sparkles size={10} className="text-emerald-600" />
                    <p className="font-jakarta text-xs font-semibold text-emerald-700">
                      Save ₹{plan.price * 12 - plan.annualPrice}/year
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

                <hr className="border-black/5 my-4" />

                {/* Price breakdown */}
                <div className="space-y-2 font-jakarta text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-800">₹{price}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount (FOUNDER20)</span>
                      <span>-₹{discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bricolage font-bold text-base pt-2 border-t border-black/5">
                    <span className="text-gray-700">Total</span>
                    <span className="text-gray-900">₹{finalPrice}</span>
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
                    { icon: RefreshCw, text: "7-day full refund policy" },
                    { icon: Zap, text: "Instant plan activation" },
                    { icon: Lock, text: "PCI-DSS compliant payment" },
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
    <div className="min-h-screen p-6 lg:p-10 flex items-center justify-center bg-[#f7f8fc]">
      <div className="text-gray-400 text-sm font-bricolage">Loading payment page…</div>
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
