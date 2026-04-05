/**
 * throttleManager.ts
 *
 * Upstash Redis–backed sliding-window RPM throttle for AI provider calls.
 *
 * Each provider tracks two Redis keys:
 *
 *   rpm:{provider}:timestamps  — Sorted Set, score = timestamp ms
 *     ZADD  to record a request
 *     ZREMRANGEBYSCORE to prune entries older than 60 s
 *     ZCARD to count remaining
 *     EXPIRE 70 s after every write (auto-cleanup)
 *
 *   rpm:{provider}:cooling — String "1" with 60 s TTL
 *     SET … EX 60 on 429
 *     EXISTS to check cooling status
 *
 * Exposes an identical interface to what aiExtraction.ts expects,
 * but all methods are async (Redis calls are network I/O).
 *
 * Environment variables required:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// ─── Provider RPM limits ───────────────────────────────────────────────────────
const PROVIDER_RPM: Record<string, number> = {
  gemini:     15,
  groq:       30,
  huggingface: 10,
  together:   60,
};

// ─── Redis singleton ───────────────────────────────────────────────────────────
// Redis.fromEnv() reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// On Vercel each cold-start creates one instance — subsequent calls within the
// same instance reuse it. Across instances, all share the same remote state.
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

// ─── Key helpers ───────────────────────────────────────────────────────────────
const tsKey      = (p: string) => `rpm:${p}:timestamps`;
const coolingKey = (p: string) => `rpm:${p}:cooling`;

// ─── Public interface ──────────────────────────────────────────────────────────

/**
 * Returns the milliseconds to wait before the next request is allowed for
 * `providerId`.  Returns 0 if the provider is within limits.
 */
export async function getWaitMs(providerId: string): Promise<number> {
  const redis = getRedis();
  const rpm   = PROVIDER_RPM[providerId] ?? 10;
  const now   = Date.now();
  const windowStart = now - 60_000; // 60-second rolling window

  // 1. Check cooldown (set on 429)
  const cooling = await redis.exists(coolingKey(providerId));
  if (cooling) {
    // TTL remaining on the cooling key
    const ttl = await redis.ttl(coolingKey(providerId));
    return Math.max(ttl * 1000, 1000); // convert seconds → ms
  }

  // 2. Prune stale timestamps, then count
  const key = tsKey(providerId);
  await redis.zremrangebyscore(key, '-inf', windowStart);
  const used = await redis.zcard(key);

  if (used < rpm) return 0; // under the limit

  // 3. Over the limit — find the oldest timestamp in the window and return
  //    how long until it ages out of the 60-second window.
  const oldest = await redis.zrange<string[]>(key, 0, 0, { withScores: false });
  if (!oldest || oldest.length === 0) return 0;

  const oldestTs = parseInt(oldest[0] as string, 10);
  const wait = (oldestTs + 60_000) - now;
  return Math.max(wait, 0);
}

/**
 * Records a successful request for `providerId` in the sliding window.
 */
export async function recordRequest(providerId: string): Promise<void> {
  const redis = getRedis();
  const now   = Date.now();
  const key   = tsKey(providerId);
  const windowStart = now - 60_000;

  // Add timestamp as both score and member (unique via ms + random suffix)
  const member = `${now}-${Math.random().toString(36).slice(2, 7)}`;
  await redis.zadd(key, { score: now, member });

  // Prune entries outside the window
  await redis.zremrangebyscore(key, '-inf', windowStart);

  // Reset TTL to 70 s so the key auto-expires if unused
  await redis.expire(key, 70);
}

/**
 * Marks `providerId` as cooling-down (e.g., after receiving a 429).
 * The key expires automatically after 60 seconds.
 */
export async function markCoolingDown(providerId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(coolingKey(providerId), '1', { ex: 60 });
}

/**
 * Returns a status snapshot of all configured providers — used for
 * monitoring / debugging.
 */
export async function getSlidingWindowStatus(): Promise<
  Record<string, { used: number; rpm: number; waitMs: number; cooling: boolean }>
> {
  const result: Record<string, { used: number; rpm: number; waitMs: number; cooling: boolean }> = {};

  await Promise.all(
    Object.entries(PROVIDER_RPM).map(async ([providerId, rpm]) => {
      const redis = getRedis();
      const now   = Date.now();
      const windowStart = now - 60_000;

      const isCooling = !!(await redis.exists(coolingKey(providerId)));

      const key = tsKey(providerId);
      await redis.zremrangebyscore(key, '-inf', windowStart);
      const used = await redis.zcard(key);
      const waitMs = await getWaitMs(providerId);

      result[providerId] = { used, rpm, waitMs, cooling: isCooling };
    })
  );

  return result;
}
