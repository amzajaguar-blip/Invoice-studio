/**
 * Simple in-memory rate limiter for API routes.
 * For production, replace with Redis-based solution (e.g., Upstash, Arcjet).
 */

const rateMap = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (entry.resetAt < now) {
      rateMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate limit a request by key (e.g., IP or user ID).
 * @param key — unique identifier (IP, user ID, or composite)
 * @param maxRequests — max requests allowed in the window
 * @param windowMs — time window in milliseconds
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Extract a rate limit key from a request.
 * Prefers authenticated user ID, falls back to IP.
 */
export function getRateLimitKey(
  request: Request,
  userId?: string
): string {
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `ip:${ip}`;
}

/** Presets for common endpoints */
export const RATE_LIMITS = {
  login: { max: 5, windowMs: 60_000 * 15 },       // 5 per 15 min
  signup: { max: 3, windowMs: 60_000 * 60 },       // 3 per hour
  api: { max: 60, windowMs: 60_000 },              // 60 per minute
  strict: { max: 10, windowMs: 60_000 },           // 10 per minute
} as const;
