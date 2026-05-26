"use client";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
  idea: ["Evaluating market signals…", "Scoring idea clarity…", "Detecting hidden risks…", "Identifying opportunities…"],
  competitor: ["Mapping the competitive landscape…", "Analyzing competitor weaknesses…", "Finding positioning gaps…", "Building your battle plan…"],
  revenue: ["Modeling monetization options…", "Crafting pricing tiers…", "Detecting revenue leaks…", "Optimizing conversion strategy…"],
  psychology: ["Profiling your target users…", "Scoring trust & credibility…", "Identifying friction points…", "Auditing first impressions…"],
  growth: ["Plotting your first 10 customers…", "Selecting highest-impact channels…", "Crafting outreach strategies…", "Building your launch playbook…"],
  decision: ["Processing founder context…", "Ranking strategic priorities…", "Calculating confidence score…", "Finalizing your action brief…"],
  "cold-dm": ["Writing your outreach messages…", "Optimizing copy for conversions…", "Generating variants…", "Crafting follow-up sequences…"],
  "brand-forge": ["Brainstorming brand names…", "Crafting your positioning…", "Defining brand personality…", "Assembling your brand pack…"],
};

export function AnalysisLoading({ engine }: { engine: string }) {
  const messages = engineMessages[engine] || ["Analyzing…"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-8 py-20 px-8"
    >
      {/* Animated rings */}
      <div className="relative flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-emerald-300/40"
            style={{ width: 48 + i * 36, height: 48 + i * 36 }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <div className="relative w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-sm shadow-emerald-100">
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
              className="font-bricolage text-sm font-semibold text-gray-700"
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
        <p className="font-jakarta text-xs text-gray-400">This usually takes 10–20 seconds</p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "90%" }}
          transition={{ duration: 18, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

export function ErrorState({ message = "Something went wrong. Please try again.", onRetry }: { message?: string; onRetry?: () => void }) {
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
        <p className="font-bricolage text-sm font-bold text-gray-900">Analysis Failed</p>
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
        <p className="font-bricolage text-base font-bold text-gray-900">{title}</p>
        <p className="font-jakarta text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}
