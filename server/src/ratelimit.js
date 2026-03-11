// server/src/ratelimit.js
// Two-layer rate limiting: IP-based (L3) and identity-based (L7).
//
// Design: No external dependencies. In-memory counters with periodic cleanup.
// Does not log IP addresses (anonymity-first), only counts.

const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

class RateLimiter {
  constructor() {
    // key -> { count, resetAt }
    this.buckets = new Map();
    this._timer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Check + increment a rate limit bucket.
   * Returns { allowed: true } or { allowed: false, retryAfterMs }.
   */
  check(key, maxPerWindow, windowMs = 60_000) {
    const now = Date.now();
    let entry = this.buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, entry);
    }
    entry.count++;
    if (entry.count <= maxPerWindow) {
      return { allowed: true };
    }
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.buckets) {
      if (entry.resetAt <= now) this.buckets.delete(key);
    }
  }

  destroy() {
    clearInterval(this._timer);
  }
}

// ── Default limits ──────────────────────────────────────────────────
// These can be overridden via environment variables.

const LIMITS = {
  // IP-based (per minute) — sized for ≤5 users behind one NAT
  IP_SEND:          parseInt(process.env.LIMIT_IP_SEND)          || 120,
  IP_DRAIN:         parseInt(process.env.LIMIT_IP_DRAIN)         || 240,
  IP_CAPS:          parseInt(process.env.LIMIT_IP_CAPS)          || 40,
  IP_DIRECTORY:     parseInt(process.env.LIMIT_IP_DIRECTORY)     || 30,
  IP_LOOKUP:        parseInt(process.env.LIMIT_IP_LOOKUP)        || 60,
  IP_HANDLE_CHECK:  parseInt(process.env.LIMIT_IP_HANDLE_CHECK) || 10,
  IP_PRESENCE:      parseInt(process.env.LIMIT_IP_PRESENCE)     || 30,
  IP_WS_CONNECT:    parseInt(process.env.LIMIT_IP_WS_CONNECT)   || 20,
  IP_BLOCK_REVOKE:  parseInt(process.env.LIMIT_IP_BLOCK_REVOKE) || 10,

  // Identity-based (per minute)
  ID_SEND:          parseInt(process.env.LIMIT_ID_SEND)          || 60,
  ID_DRAIN:         parseInt(process.env.LIMIT_ID_DRAIN)         || 60,
  ID_CAPS:          parseInt(process.env.LIMIT_ID_CAPS)          || 10,
  ID_SIG_FAIL:      parseInt(process.env.LIMIT_ID_SIG_FAIL)      || 5,  // failed sig attempts
  ID_CAP_FAIL:      parseInt(process.env.LIMIT_ID_CAP_FAIL)      || 10, // failed cap attempts
};

/**
 * Extract client IP from request.
 * Relies on Express's req.ip (respects "trust proxy" setting) instead of
 * reading X-Forwarded-For directly, which is spoofable.
 */
function getIpKey(req) {
  const raw = req.ip || "unknown";
  return `ip:${raw}`;
}

module.exports = {
  RateLimiter,
  LIMITS,
  getIpKey,
};
