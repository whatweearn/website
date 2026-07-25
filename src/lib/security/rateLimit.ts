/**
 * Fixed-window rate limiter.
 *
 * In-memory, which means per-instance: two serverless instances each allow the
 * full quota. That is acceptable for now because it is one of several layers
 * (Turnstile does the real work), but it must move to a shared store before
 * traffic is spread across regions. Tracked as a Phase 6 item.
 *
 * Keys are same-day handles from identity.ts — never addresses.
 */

type Window = { count: number; resetAt: number };

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  limit: number = MAX_PER_WINDOW,
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    windows.set(key, fresh);
    sweep(now);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Drops expired windows so the map cannot grow without bound. */
function sweep(now: number) {
  if (windows.size < 1000) return;
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key);
  }
}

/** Test seam. */
export function resetRateLimits() {
  windows.clear();
}

export const RATE_LIMIT = { WINDOW_MS, MAX_PER_WINDOW };
