import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

// ============================================
// RATE LIMITER — LRU Cache Based
// No external Redis dependency for hackathon
// Production: replace with Upstash Redis
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;   // Time window in milliseconds
  max: number;        // Max requests per window
  keyPrefix?: string; // Prefix for cache key namespacing
}

// Shared LRU cache across all rate limiters
// Max 10,000 unique IPs stored in memory
const cache = new LRUCache<string, RateLimitEntry>({
  max: 10_000,
  ttl: 60 * 60 * 1000, // 1 hour max TTL
});

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private keyPrefix: string;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.keyPrefix = options.keyPrefix ?? "rl";
  }

  check(identifier: string): {
    success: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  } {
    const key = `${this.keyPrefix}:${identifier}`;
    const now = Date.now();
    const existing = cache.get(key);

    if (!existing || now > existing.resetAt) {
      // Fresh window
      const entry: RateLimitEntry = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      cache.set(key, entry);
      return {
        success: true,
        remaining: this.max - 1,
        resetAt: entry.resetAt,
      };
    }

    if (existing.count >= this.max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      return {
        success: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfter,
      };
    }

    // Increment count
    existing.count += 1;
    cache.set(key, existing);

    return {
      success: true,
      remaining: this.max - existing.count,
      resetAt: existing.resetAt,
    };
  }

  reset(identifier: string): void {
    const key = `${this.keyPrefix}:${identifier}`;
    cache.delete(key);
  }
}

// --- Pre-configured limiters for different endpoints ---

// AI engine analysis: 10 requests per minute per IP
export const analysisRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: "analyze",
});

// Generation endpoints: 15 requests per minute per IP
export const generationRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  keyPrefix: "generate",
});

// General API: 60 requests per minute per IP
export const generalRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "general",
});

// --- Helper to extract client IP ---
export function getRequestIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (cfIp) return cfIp;
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

// --- Rate limit response helper ---
export function rateLimitResponse(retryAfter: number): NextResponse {
  return new NextResponse(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please slow down.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
