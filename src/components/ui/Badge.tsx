import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "sage" | "cocoa" | "forest" | "peach" | "midnight" | "neutral" | "blush" | "emerald" | "violet" | "amber" | "rose" | "blue";
  size?: "sm" | "md";
  className?: string;
  dot?: boolean;
}

const variants = {
  // New palette
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-600 border-rose-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-gray-50 text-gray-600 border-gray-200",
  // Legacy aliases
  sage: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cocoa: "bg-amber-50 text-amber-700 border-amber-200",
  forest: "bg-teal-50 text-teal-700 border-teal-200",
  peach: "bg-rose-50 text-rose-600 border-rose-200",
  midnight: "bg-blue-50 text-blue-700 border-blue-200",
  blush: "bg-pink-50 text-pink-600 border-pink-200",
};

const dotColors = {
  emerald: "bg-emerald-500", violet: "bg-violet-500", amber: "bg-amber-500",
  rose: "bg-rose-500", blue: "bg-blue-500", neutral: "bg-gray-400",
  sage: "bg-emerald-500", cocoa: "bg-amber-500", forest: "bg-teal-500",
  peach: "bg-rose-500", midnight: "bg-blue-500", blush: "bg-pink-500",
};

export default function Badge({ children, variant = "neutral", size = "sm", className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full font-bricolage font-semibold leading-none",
        variants[variant],
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        className
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColors[variant])} />}
      {children}
    </span>
  );
}
