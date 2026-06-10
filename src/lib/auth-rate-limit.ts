/**
 * Per-IP in-memory rate limiter for the login endpoint.
 *
 * NOTE: This is a per-warm-instance counter. On serverless runtimes (Vercel)
 * each function instance maintains its own map, so the limit is best-effort
 * per warm instance rather than globally enforced. This is acceptable for a
 * single-user app — the argon2id verify (~100–200 ms) already slows brute
 * force, and this counter further raises the cost. If global enforcement is
 * ever required, swap this module to use the login_attempts Postgres table.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 10;

interface Entry {
  count: number;
  windowStart: number;
}

const attempts = new Map<string, Entry>();

/** Returns whether the IP is allowed to attempt login. */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // No entry yet, or the window has expired — allow.
    return { allowed: true };
  }

  if (entry.count >= MAX_FAILURES) {
    const retryAfterSeconds = Math.ceil(
      (WINDOW_MS - (now - entry.windowStart)) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/** Records a failed login attempt for the given IP. */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}
