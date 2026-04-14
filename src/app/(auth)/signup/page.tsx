"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

type Status = "idle" | "loading" | "success" | "error";

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validatePassword(v: string) {
  return v.length >= 8;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!validateEmail(email)) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (!validatePassword(password)) errs.password = "Password must be at least 8 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signup failed. Please try again.";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSignup();
  };

  if (status === "success") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-md text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shadow-md shadow-emerald-100">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
          </div>
          <div>
            <h1 className="font-bricolage text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>
            <p className="font-jakarta text-sm text-gray-500 leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="text-gray-900 font-semibold">{email}</span>.
              <br />Click it to activate your account and get started.
            </p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-white p-5 text-left space-y-2.5 shadow-sm">
            <p className="font-bricolage text-xs font-bold text-gray-400 uppercase tracking-wide">Next steps</p>
            {["Check your email (including spam folder)", "Click the confirmation link", "Log in and start building"].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="font-bricolage text-[9px] font-bold text-emerald-600">{i + 1}</span>
                </span>
                <span className="font-jakarta text-sm text-gray-600">{step}</span>
              </div>
            ))}
          </div>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 font-bricolage text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Go to sign in <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md space-y-7"
      >
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-7">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bricolage text-lg font-bold text-gray-900">
              StartupX <span className="text-gradient-brand">AI</span>
            </span>
          </Link>
          <h1 className="font-bricolage text-2xl font-bold text-gray-900 mb-1.5">Create your account</h1>
          <p className="font-jakarta text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/signin" className="text-emerald-600 hover:text-emerald-700 transition-colors font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/8 bg-white p-8 space-y-5 shadow-lg shadow-black/5">
          {/* Perks banner */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 flex items-start gap-3">
            <Sparkles size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="font-jakarta text-xs text-emerald-700 leading-relaxed">
              <strong className="font-semibold">Free to start</strong> — Get access to 6 AI intelligence engines, ColdDM AI, and BrandForge AI instantly.
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
              Email address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                onKeyDown={handleKeyDown}
                className={[
                  "w-full h-11 pl-10 pr-4 rounded-xl font-jakarta text-sm",
                  "bg-white text-gray-900 placeholder:text-gray-400",
                  "border-1.5 transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
                  fieldErrors.email
                    ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-black/10 hover:border-black/20",
                ].join(" ")}
                style={{ border: fieldErrors.email ? "1.5px solid #fb7185" : "1.5px solid rgba(0,0,0,0.10)" }}
              />
            </div>
            {fieldErrors.email && (
              <p className="font-jakarta text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-11 pl-10 pr-11 rounded-xl font-jakarta text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-150"
                style={{ border: fieldErrors.password ? "1.5px solid #fb7185" : "1.5px solid rgba(0,0,0,0.10)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="font-jakarta text-xs text-rose-500 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {status === "error" && errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-2.5"
              >
                <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="font-jakarta text-sm text-rose-700">{errorMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            onClick={handleSignup}
            disabled={status === "loading"}
            className={[
              "w-full h-11 rounded-xl font-bricolage text-sm font-bold text-white",
              "bg-gradient-to-br from-emerald-500 to-emerald-600",
              "shadow-md shadow-emerald-500/25",
              "transition-all duration-200",
              "hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5",
              "active:translate-y-0",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0",
              "flex items-center justify-center gap-2",
            ].join(" ")}
          >
            {status === "loading" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account…
              </>
            ) : (
              <>Create free account <ArrowRight size={15} /></>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center font-jakarta text-xs text-gray-400 leading-relaxed">
          By creating an account you agree to our{" "}
          <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}
