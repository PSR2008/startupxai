"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: "sm" | "md";
  label?: string;
  showLabel?: boolean;
}

export default function CopyButton({ text, className, size = "sm", label = "Copy", showLabel = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const iconSize = size === "sm" ? 13 : 15;

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 transition-all duration-200",
        "rounded-lg border font-bricolage text-xs font-semibold",
        copied
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-black/8 bg-gray-50 text-gray-500 hover:bg-white hover:text-gray-800 hover:border-black/14 hover:shadow-sm",
        size === "sm" ? "px-2 py-1" : "px-3 py-1.5",
        className
      )}
      title={label}
      aria-label={label}
    >
      {copied ? <Check size={iconSize} className="text-emerald-600" /> : <Copy size={iconSize} />}
      {showLabel && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}
