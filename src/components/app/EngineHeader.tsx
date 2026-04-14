"use client";
import { motion } from "framer-motion";

interface EngineHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "sage" | "cocoa" | "peach" | "midnight" | "forest";
  accentColor?: string;
}

export default function EngineHeader({
  icon,
  title,
  description,
  badge,
  accentColor = "#10b981",
}: EngineHeaderProps) {
  return (
    <div className="pb-6 border-b border-black/6">
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm"
          style={{
            background: `${accentColor}10`,
            borderColor: `${accentColor}22`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="font-bricolage text-xl font-bold text-gray-900"
            >
              {title}
            </motion.h1>
            {badge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bricolage font-bold border uppercase tracking-wider"
                style={{
                  background: `${accentColor}10`,
                  color: accentColor,
                  borderColor: `${accentColor}25`,
                }}
              >
                {badge}
              </motion.span>
            )}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-jakarta text-sm text-gray-500 leading-relaxed"
          >
            {description}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
