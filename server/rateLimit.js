// Small in-memory rate limiter. Enough to stop a single client from flooding
// the leaderboard; it is per-process and resets when the machine restarts.

export function createRateLimiter({ limit = 20, windowMs = 60000, maxKeys = 5000 } = {}) {
  // key -> { count, windowStart }
  const buckets = new Map();

  function dropExpired(now) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) buckets.delete(key);
    }
  }

  function evictOverflow() {
    // Map preserves insertion order, so the front entries are the oldest.
    while (buckets.size > maxKeys) {
      buckets.delete(buckets.keys().next().value);
    }
  }

  return {
    // Returns true when the request is allowed.
    check(key, now = Date.now()) {
      const id = key === undefined || key === null ? 'unknown' : String(key);
      dropExpired(now);

      const bucket = buckets.get(id);
      if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.set(id, { count: 1, windowStart: now });
        evictOverflow();
        return true;
      }

      if (bucket.count >= limit) return false;

      bucket.count++;
      return true;
    },

    size() {
      return buckets.size;
    }
  };
}
