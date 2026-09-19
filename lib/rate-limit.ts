/**
 * Fixed-window rate limiter kept in process memory.
 *
 * Good enough for a single-node deployment and for development. On a
 * multi-instance deployment each instance keeps its own counters, so the
 * effective limit is `limit × instances` — set RATE_LIMIT_DISABLED only in
 * tests, and move this behind Redis/Upstash if you scale horizontally.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Hard ceiling on tracked keys so a flood of unique IPs cannot exhaust memory. */
const MAX_KEYS = 50_000;

export type RateLimitResult = {
  ok: boolean;
  /** Attempts left in the current window. */
  remaining: number;
  /** Seconds until the window resets — send as `Retry-After`. */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { ok: true, remaining: limit, retryAfter: 0 };
  }

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count >= limit) return { ok: false, remaining: 0, retryAfter };

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfter };
}

/** Back-compatible boolean form: true when the request may proceed. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  return rateLimit(key, limit, windowMs).ok;
}

/**
 * Named limits, so the numbers live in one place and are easy to review.
 * `[limit, windowMs]`.
 */
export const LIMITS = {
  login: [8, 15 * 60_000],
  passwordReset: [5, 60 * 60_000],
  lead: [8, 60_000],
  contact: [8, 60_000],
  booking: [10, 60_000],
  pricing: [60, 60_000],
  paymentVerify: [20, 60_000],
  upload: [30, 60_000],
  publicApi: [120, 60_000],
  adminExport: [10, 60_000],
} as const satisfies Record<string, readonly [number, number]>;

export function limitFor(
  name: keyof typeof LIMITS,
  key: string,
): RateLimitResult {
  const [limit, windowMs] = LIMITS[name];
  return rateLimit(`${name}:${key}`, limit, windowMs);
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live buckets — drop the oldest entries to stay bounded.
  if (buckets.size >= MAX_KEYS) {
    const overflow = buckets.size - Math.floor(MAX_KEYS * 0.9);
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= overflow) break;
    }
  }
}

/** Test helper — clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}

// Periodic cleanup to avoid unbounded growth.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => evictExpired(Date.now()), 60_000);
  timer.unref?.();
}
