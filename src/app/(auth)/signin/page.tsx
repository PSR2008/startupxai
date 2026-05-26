"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

type Status = "idle" | "loading" | "error";

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignin = async () => {
    if (!validate()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Sign in failed.";
      const msg =
        raw.includes("Invalid login credentials") || raw.includes("invalid_credentials")
          ? "Incorrect email or password. Please try again."
          : raw.includes("Email not confirmed")
          ? "Please confirm your email before signing in. Check your inbox."
          : raw;
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSignin();
  };

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
          <h1 className="font-bricolage text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h1>
          <p className="font-jakarta text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 transition-colors font-semibold">
              Sign up free
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/8 bg-white p-8 space-y-5 shadow-lg shadow-black/5">
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
                className="w-full h-11 pl-10 pr-4 rounded-xl font-jakarta text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-150"
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
            <div className="flex items-center justify-between">
              <label className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
                Password <span className="text-rose-500">*</span>
              </label>
              <span className="font-jakarta text-xs text-gray-400 cursor-not-allowed select-none" title="Coming soon">
                Forgot password?
              </span>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                  if (status === "error") setStatus("idle");
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-11 pl-10 pr-11 rounded-xl font-jakarta text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-150"
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

          {/* Error */}
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
            onClick={handleSignin}
            disabled={status === "loading"}
            className="w-full h-11 rounded-xl font-bricolage text-sm font-bold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            {status === "loading" ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>Sign in to StartupX <ArrowRight size={15} /></>
            )}
          </button>
        </div>

        {/* Back */}
        <p className="text-center font-jakarta text-xs text-gray-400">
          <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
