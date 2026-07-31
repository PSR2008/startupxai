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
  title,
  description,
  badge,
  accentColor = "#10b981",
}: EngineHeaderProps) {
  return (
    <div className="editorial-section pb-6 pt-5">
      <div className="border-l border-black/10 pl-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="font-jakarta text-[1.35rem] font-bold leading-tight text-gray-950"
            >
              {title}
            </motion.h1>
            {badge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center rounded-md border px-2 py-0.5 font-jakarta text-[10px] font-semibold leading-none"
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
            className="max-w-3xl font-jakarta text-sm leading-relaxed text-gray-600"
          >
            {description}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
