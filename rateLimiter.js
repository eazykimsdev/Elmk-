import fs from 'fs';
import path from 'path';

/**
 * ConnectingERLC Token Bucket Rate Limiter
 * Pluggable store interface designed for easy Redis swap-in.
 */

class MemoryTokenBucketStore {
  constructor() {
    this.buckets = new Map();
    this.violations = new Map();
    this.abuseCooldowns = new Map();

    // Auto-cleanup stale buckets every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, b] of this.buckets) {
        if (now - b.lastRefill > 10 * 60 * 1000) {
          this.buckets.delete(key);
        }
      }
      for (const [key, exp] of this.abuseCooldowns) {
        if (exp < now) {
          this.abuseCooldowns.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  getBucket(key, capacity, refillPerMinute) {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: capacity, capacity, refillRatePerMs: refillPerMinute / 60000, lastRefill: now };
      this.buckets.set(key, b);
      return b;
    }
    // Refill tokens based on elapsed time
    const elapsed = now - b.lastRefill;
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRatePerMs);
    b.lastRefill = now;
    return b;
  }

  consume(key, capacity, refillPerMinute, cost = 1) {
    const b = this.getBucket(key, capacity, refillPerMinute);
    if (b.tokens >= cost) {
      b.tokens -= cost;
      return { allowed: true, remaining: Math.floor(b.tokens), retryAfterSeconds: 0 };
    }
    const needed = cost - b.tokens;
    const retryAfterSeconds = Math.max(1, Math.ceil(needed / (b.refillRatePerMs * 1000)));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  isUserCooldownActive(userId) {
    const exp = this.abuseCooldowns.get(userId);
    if (exp && exp > Date.now()) {
      return Math.ceil((exp - Date.now()) / 1000);
    }
    return 0;
  }

  recordViolation(userId, ip) {
    const now = Date.now();
    const key = userId || ip;
    if (!key) return false;

    let v = this.violations.get(key) || [];
    v = v.filter(ts => now - ts < 10 * 60 * 1000); // 10 minute rolling window
    v.push(now);
    this.violations.set(key, v);

    // 10 violations in 10 minutes -> 15 minute cooldown for writes
    if (v.length >= 10) {
      const cooldownExp = now + 15 * 60 * 1000;
      this.abuseCooldowns.set(key, cooldownExp);
      this.violations.delete(key);

      // Add audit entry to admin Flags queue
      try {
        const flagsPath = path.join(process.cwd(), 'data', 'flags.json');
        let flags = [];
        if (fs.existsSync(flagsPath)) {
          flags = JSON.parse(fs.readFileSync(flagsPath, 'utf8') || '[]');
        }
        flags.push({
          id: `flag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'RATE_LIMIT_ABUSE',
          targetId: userId || ip,
          reason: '10 rate limit rejections within 10 minutes. 15 minute write cooldown applied.',
          status: 'PENDING',
          createdAt: new Date().toISOString()
        });
        fs.writeFileSync(flagsPath, JSON.stringify(flags, null, 2));
      } catch (err) {
        console.warn('[RATE LIMIT] Could not record abuse flag:', err.message);
      }
      return true;
    }
    return false;
  }
}

export const store = new MemoryTokenBucketStore();

export const ACTION_LIMITS = {
  bump: 5,
  review: 3,
  settings: 20,
  partnership: 10,
  join: 10,
  invite: 10,
  search: 60,
  write: 60,
  overall: 240,
  ip: 600
};

/**
 * Express middleware for endpoint-specific token bucket rate limiting.
 */
export function createRateLimiter(actionType = 'write') {
  const limitPerMinute = ACTION_LIMITS[actionType] || ACTION_LIMITS.write;

  return (req, res, next) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    // Check if user is in 15-minute abuse cooldown for write endpoints
    if (userId) {
      const cooldownRem = store.isUserCooldownActive(userId);
      if (cooldownRem > 0 && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        res.set('Retry-After', String(cooldownRem));
        return res.status(429).json({
          code: 'RATE_LIMITED',
          error: `Temporary cooldown active due to repeated requests. Try again in ${cooldownRem} seconds.`,
          retryAfterSeconds: cooldownRem
        });
      }
    }

    // Check IP bucket first (max 600 requests per minute per IP)
    const ipRes = store.consume(`ip:${ip}`, ACTION_LIMITS.ip, ACTION_LIMITS.ip);
    if (!ipRes.allowed) {
      res.set('Retry-After', String(ipRes.retryAfterSeconds));
      return res.status(429).json({
        code: 'RATE_LIMITED',
        error: `Too many requests from this IP. Please wait ${ipRes.retryAfterSeconds} seconds.`,
        retryAfterSeconds: ipRes.retryAfterSeconds
      });
    }

    // Check User / Client Action bucket
    const actorKey = userId ? `user:${userId}` : `ip:${ip}`;

    // Overall user limit (240 / min)
    if (userId) {
      const overallRes = store.consume(`overall:${userId}`, ACTION_LIMITS.overall, ACTION_LIMITS.overall);
      if (!overallRes.allowed) {
        store.recordViolation(userId, ip);
        res.set('Retry-After', String(overallRes.retryAfterSeconds));
        return res.status(429).json({
          code: 'RATE_LIMITED',
          error: `You're going too fast. Try again in ${overallRes.retryAfterSeconds} seconds.`,
          retryAfterSeconds: overallRes.retryAfterSeconds
        });
      }
    }

    // Specific action limit
    const actionRes = store.consume(`${actionType}:${actorKey}`, limitPerMinute, limitPerMinute);
    if (!actionRes.allowed) {
      store.recordViolation(userId, ip);
      res.set('Retry-After', String(actionRes.retryAfterSeconds));
      return res.status(429).json({
        code: 'RATE_LIMITED',
        error: `You're going too fast. Try again in ${actionRes.retryAfterSeconds} seconds.`,
        retryAfterSeconds: actionRes.retryAfterSeconds
      });
    }

    res.set('X-RateLimit-Remaining', String(actionRes.remaining));
    next();
  };
}

