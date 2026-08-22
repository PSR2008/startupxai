"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, Crown, Lock, RefreshCw } from "lucide-react";
import Button from "./Button";

export function LoadingSpinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const dimensions = { sm: 20, md: 32, lg: 48 };
  const d = dimensions[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={d} height={d} viewBox="0 0 32 32" fill="none" className="animate-spin" style={{ animationDuration: "0.8s" }}>
        <circle cx="16" cy="16" r="12" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
        <path d="M16 4 A12 12 0 0 1 28 16" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <p className="font-jakarta text-sm text-gray-500 animate-pulse">{label}</p>}
    </div>
  );
}

const engineMessages: Record<string, string[]> = {
  idea: ["Reviewing assumptions...", "Checking clarity signals...", "Listing risks...", "Preparing findings..."],
  competitor: ["Mapping competitors...", "Reviewing positioning...", "Listing gaps...", "Preparing comparison..."],
  revenue: ["Reviewing monetization options...", "Preparing pricing structure...", "Listing conversion risks...", "Preparing findings..."],
  psychology: ["Reviewing trust signals...", "Checking friction points...", "Auditing first impressions...", "Preparing recommendations..."],
  growth: ["Reviewing acquisition context...", "Selecting testable channels...", "Preparing outreach steps...", "Building launch sequence..."],
  decision: ["Reviewing founder context...", "Ranking priorities...", "Checking confidence...", "Preparing action brief..."],
  "cold-dm": ["Drafting outreach...", "Preparing variants...", "Checking tone...", "Preparing follow-ups..."],
  "brand-forge": ["Drafting name options...", "Preparing positioning...", "Defining voice...", "Assembling brand pack..."],
  evidence: ["Reviewing evidence...", "Checking missing sources...", "Calculating score components...", "Preparing next actions..."],
};

export function AnalysisLoading({ engine }: { engine: string }) {
  const messages = engineMessages[engine] || ["Analyzing..."];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-8 py-20 px-8"
    >
      <div className="relative flex items-center justify-center">
        <div className="relative w-12 h-12 rounded-xl bg-white border border-black/8 flex items-center justify-center shadow-sm">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="animate-spin" style={{ animationDuration: "1s" }}>
            <circle cx="16" cy="16" r="12" stroke="rgba(16,185,129,0.2)" strokeWidth="3" />
            <path d="M16 4 A12 12 0 0 1 28 16" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Cycling messages */}
      <div className="text-center space-y-2">
        <motion.div className="h-6 overflow-hidden">
          {messages.map((msg, i) => (
            <motion.p
              key={msg}
              className="font-jakarta text-sm font-semibold text-gray-700"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
              transition={{
                duration: 2.5, delay: i * 2.5, repeat: Infinity,
                repeatDelay: messages.length * 2.5 - 2.5, times: [0, 0.15, 0.85, 1],
              }}
            >
              {msg}
            </motion.p>
          ))}
        </motion.div>
        <p className="font-jakarta text-xs text-gray-400">This usually takes 10-20 seconds</p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden" aria-hidden>
        <motion.div
          className="h-full bg-emerald-700 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "90%" }}
          transition={{ duration: 18, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

export function ErrorState({ message = "Something went wrong. Please try again.", onRetry }: { message?: string; onRetry?: () => void }) {
  const isUsageLimit =
    message.includes("PLAN_LIMIT_REACHED") ||
    message.includes("monthly analysis limit") ||
    message.includes("used all") ||
    message.includes("remaining this month") ||
    message.includes("free analyses");
  const isPlanLocked =
    message.includes("FEATURE_NOT_AVAILABLE") ||
    message.includes("available on Founder") ||
    message.includes("available on Growth") ||
    message.includes("not available on your current plan");
  const isAuth = message.includes("AUTHENTICATION_REQUIRED") || message.includes("sign in");

  if (isUsageLimit) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 py-16 px-8 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shadow-sm shadow-amber-100">
          <Crown size={20} className="text-amber-600" />
        </div>
        <div className="space-y-1">
          <p className="font-jakarta text-sm font-bold text-gray-900">Usage Limit Reached</p>
          <p className="font-jakarta text-sm text-gray-500 max-w-sm">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/payment?plan=founder">
            <Button size="sm" icon={<Crown size={13} />}>
              Upgrade plan
            </Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" size="sm">
              View usage
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  if (isPlanLocked || isAuth) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 py-16 px-8 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shadow-sm shadow-amber-100">
          {isAuth ? <Lock size={20} className="text-amber-600" /> : <Crown size={20} className="text-amber-600" />}
        </div>
        <div className="space-y-1">
          <p className="font-jakarta text-sm font-bold text-gray-900">{isAuth ? "Sign In Required" : "Upgrade Required"}</p>
          <p className="font-jakarta text-sm text-gray-500 max-w-sm">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={isAuth ? "/signin" : "/payment?plan=founder"}>
            <Button size="sm" icon={isAuth ? <Lock size={13} /> : <Crown size={13} />}>
              {isAuth ? "Sign in" : "Upgrade plan"}
            </Button>
          </Link>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw size={13} />}>
              Try again
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 py-16 px-8 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shadow-sm shadow-rose-100">
        <AlertTriangle size={20} className="text-rose-500" />
      </div>
      <div className="space-y-1">
        <p className="font-jakarta text-sm font-bold text-gray-900">Analysis Failed</p>
        <p className="font-jakarta text-sm text-gray-500 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw size={13} />}>
          Try Again
        </Button>
      )}
    </motion.div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-5 py-20 px-8 text-center"
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-black/6 flex items-center justify-center text-gray-400 shadow-sm">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="font-jakarta text-base font-bold text-gray-900">{title}</p>
        <p className="font-jakarta text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}

