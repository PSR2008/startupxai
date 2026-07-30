"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

type Status = "idle" | "loading" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleReset = async () => {
    if (password.length < 8) {
      setStatus("error");
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("success");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not update password. Open the reset link from your email and try again.");
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative z-10 w-full max-w-md space-y-7">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-7">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-jakarta text-lg font-bold text-gray-900">
              StartupX <span className="text-gradient-brand">AI</span>
            </span>
          </Link>
          <h1 className="font-jakarta text-2xl font-bold text-gray-900 mb-1.5">Choose a new password</h1>
          <p className="font-jakarta text-sm text-gray-500">Use at least 8 characters.</p>
        </div>

        <div className="rounded-2xl border border-black/8 bg-white p-8 space-y-5 shadow-lg shadow-black/5">
          {status === "success" ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-jakarta text-base font-bold text-gray-900">Password updated</p>
                <p className="mt-1 font-jakarta text-sm text-gray-500">Taking you back to the dashboard.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="font-jakarta text-sm font-semibold text-gray-700">
                  New password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleReset();
                    }}
                    className="w-full h-11 pl-10 pr-11 rounded-xl font-jakarta text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-150"
                    style={{ border: status === "error" ? "1.5px solid #fb7185" : "1.5px solid rgba(0,0,0,0.10)" }}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {status === "error" && errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-2.5">
                  <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="font-jakarta text-sm text-rose-700">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={status === "loading"}
                className="w-full h-11 rounded-xl font-jakarta text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {status === "loading" ? "Updating password..." : <>Update password <ArrowRight size={15} /></>}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
