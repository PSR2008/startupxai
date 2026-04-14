import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a score (0-100) with color classification
export function getScoreColor(score: number): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  if (score >= 75) {
    return {
      color: "text-sage-400",
      bg: "bg-sage-900/20",
      border: "border-sage-700/30",
      label: "Strong",
    };
  }
  if (score >= 50) {
    return {
      color: "text-ivory-400",
      bg: "bg-ivory-900/20",
      border: "border-ivory-700/30",
      label: "Moderate",
    };
  }
  return {
    color: "text-peach-400",
    bg: "bg-peach-900/20",
    border: "border-peach-700/30",
    label: "Needs Work",
  };
}

// Calculate SVG circle dash offset for score rings
export function getScoreDashOffset(score: number, radius = 45): number {
  const circumference = 2 * Math.PI * radius;
  return circumference - (score / 100) * circumference;
}

// Truncate text to a max length
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

// Slugify a string
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Generate a random session ID
export function generateSessionId(): string {
  return `sx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Format a number as a percentage string
export function toPercent(score: number): string {
  return `${Math.round(score)}%`;
}

// Delay (promise-based)
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Safe JSON parse
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// Hash an IP address (for rate limiting logs, privacy)
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.IP_HASH_SALT || "salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// Get the real IP from request headers
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  
  if (cfIp) return cfIp;
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "unknown";
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format label for effort/impact levels
export function formatLevel(level: "low" | "medium" | "high"): {
  label: string;
  color: string;
} {
  const map = {
    low: { label: "Low", color: "text-sage-400" },
    medium: { label: "Medium", color: "text-ivory-400" },
    high: { label: "High", color: "text-peach-400" },
  };
  return map[level];
}

// Sanitize user input (prevent XSS in rendered content)
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/`/g, "&#096;")
    .trim();
}

// Format date string
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Check if a string is a valid URL
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Engine color map for UI
export const ENGINE_COLORS: Record<string, { accent: string; glow: string; chip: string }> = {
  idea: {
    accent: "#72845e",
    glow: "rgba(114, 132, 94, 0.2)",
    chip: "bg-sage-900/30 text-sage-400 border-sage-700/30",
  },
  competitor: {
    accent: "#9e724e",
    glow: "rgba(158, 114, 78, 0.2)",
    chip: "bg-cocoa-900/30 text-cocoa-400 border-cocoa-700/30",
  },
  revenue: {
    accent: "#447e58",
    glow: "rgba(68, 126, 88, 0.2)",
    chip: "bg-forest-900/30 text-forest-400 border-forest-700/30",
  },
  psychology: {
    accent: "#ec6e38",
    glow: "rgba(236, 110, 56, 0.2)",
    chip: "bg-peach-900/30 text-peach-400 border-peach-700/30",
  },
  growth: {
    accent: "#4a63b5",
    glow: "rgba(74, 99, 181, 0.2)",
    chip: "bg-midnight-900/30 text-midnight-400 border-midnight-700/30",
  },
  decision: {
    accent: "#b28b69",
    glow: "rgba(178, 139, 105, 0.2)",
    chip: "bg-cocoa-900/30 text-cocoa-300 border-cocoa-700/30",
  },
};
