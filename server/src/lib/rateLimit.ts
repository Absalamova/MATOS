import { tooMany } from './errors.ts';
import type { Ctx } from '../http.ts';

interface Rule {
  method: string;
  path: string;
  limit: number;
  windowSec: number;
}

/** Per-IP limits for endpoints that attract abuse; everything else shares a generous global budget. */
const RULES: Rule[] = [
  { method: 'POST', path: '/api/auth/login', limit: 10, windowSec: 300 },
  { method: 'POST', path: '/api/auth/register', limit: 6, windowSec: 1800 },
  { method: 'POST', path: '/api/admin/auth/login', limit: 8, windowSec: 600 },
  { method: 'POST', path: '/api/orders', limit: 12, windowSec: 600 },
  { method: 'POST', path: '/api/tailor-requests', limit: 10, windowSec: 1800 },
  { method: 'POST', path: '/api/tailors/apply', limit: 4, windowSec: 3600 },
];
const GLOBAL = { limit: 900, windowSec: 60 };

/**
 * Fixed-window counters kept in memory. Good for a single API process; with several instances
 * put the limits in the reverse proxy (nginx limit_req) or a shared store instead.
 */
export function createRateLimiter(opts: { multiplier?: number } = {}) {
  const k = opts.multiplier ?? 1;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const hit = (key: string, limit: number, windowSec: number) => {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowSec * 1000 };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > limit * k) throw tooMany();
  };

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, 60_000);
  sweep.unref();

  const check = (ctx: Ctx) => {
    hit(`g:${ctx.ip}`, GLOBAL.limit, GLOBAL.windowSec);
    for (const r of RULES) {
      if (r.method === ctx.method && r.path === ctx.path) hit(`${r.path}:${ctx.ip}`, r.limit, r.windowSec);
    }
  };
  check.stop = () => clearInterval(sweep);
  return check;
}
