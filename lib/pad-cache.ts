/**
 * Short-TTL cache for pad live list feeds (Ethics, Ember, Bags, Perpspad, ClawPump, LFOwn, RevShare, …).
 *
 * - Redis when REDIS_URL or REDIS_PRIVATE_URL is set (Railway).
 * - In-memory Map fallback for local / when Redis is missing or down (fail open).
 * - TTL: PAD_CACHE_TTL_SECONDS (default 25s). Near-live, not static.
 * - Keys: `padfeed:<padId>:<phase>` (phase = fast | full).
 * - Summary rollups: `padsummary:<padId>` (same TTL; successful ok rows only).
 * - Cache only successful non-empty payloads — never invent rows, never pin pending stubs.
 * - Routes stay force-dynamic; this helper is the throttle.
 */

import { createClient, type RedisClientType } from "redis";

/** Default TTL seconds when PAD_CACHE_TTL_SECONDS unset / invalid. Documented: 25s. */
export const PAD_CACHE_TTL_DEFAULT_SECONDS = 25;

type MemoryEntry = { expiresAt: number; payload: string };

const memory = new Map<string, MemoryEntry>();

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;

function ttlSeconds(): number {
  const raw = process.env.PAD_CACHE_TTL_SECONDS?.trim();
  const n = raw ? Number(raw) : PAD_CACHE_TTL_DEFAULT_SECONDS;
  if (!Number.isFinite(n) || n < 1 || n > 3600) {
    return PAD_CACHE_TTL_DEFAULT_SECONDS;
  }
  return Math.floor(n);
}

function redisUrl(): string | undefined {
  const url =
    process.env.REDIS_URL?.trim() || process.env.REDIS_PRIVATE_URL?.trim();
  return url || undefined;
}

export function padCacheKey(padId: string, phase: string): string {
  const p = phase === "fast" ? "fast" : "full";
  return `padfeed:${padId}:${p}`;
}

/** Homepage single-pad rollup cache key (aggregates from fast feed). */
export function padSummaryCacheKey(padId: string): string {
  return `padsummary:${padId}`;
}

async function getRedis(): Promise<RedisClientType | null> {
  const url = redisUrl();
  if (!url) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    try {
      const client = createClient({ url });
      client.on("error", () => {
        // Fail open — callers fall through to memory / upstream.
      });
      await client.connect();
      redisClient = client as RedisClientType;
      return redisClient;
    } catch {
      redisClient = null;
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

function memoryGet<T>(key: string): T | undefined {
  const entry = memory.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memory.delete(key);
    return undefined;
  }
  try {
    return JSON.parse(entry.payload) as T;
  } catch {
    memory.delete(key);
    return undefined;
  }
}

function memorySet(key: string, value: unknown, ttlSec: number): void {
  memory.set(key, {
    expiresAt: Date.now() + ttlSec * 1000,
    payload: JSON.stringify(value),
  });
}

/**
 * Default: cache non-empty token arrays / objects with non-empty `tokens`.
 * Skip pending stubs and empty failure stand-ins.
 */
export function defaultPadCacheable(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.pending === true) return false;
    if (Array.isArray(obj.tokens)) return obj.tokens.length > 0;
  }
  return true;
}

export type CachedPadFeedOptions<T> = {
  shouldCache?: (value: T) => boolean;
};

/**
 * Check Redis → memory → loader for an arbitrary key. Fail open on Redis errors.
 */
export async function cachedByKey<T>(
  key: string,
  loader: () => Promise<T>,
  opts?: CachedPadFeedOptions<T>,
): Promise<T> {
  const ttl = ttlSeconds();
  const shouldCache = opts?.shouldCache ?? defaultPadCacheable;

  try {
    const redis = await getRedis();
    if (redis) {
      const hit = await redis.get(key);
      if (hit != null) {
        return JSON.parse(hit) as T;
      }
    }
  } catch {
    // Redis down / parse error — try memory then upstream.
  }

  const memHit = memoryGet<T>(key);
  if (memHit !== undefined) return memHit;

  const value = await loader();

  if (shouldCache(value as unknown as T)) {
    memorySet(key, value, ttl);
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.setEx(key, ttl, JSON.stringify(value));
      }
    } catch {
      // Memory already warmed; upstream still returned.
    }
  }

  return value;
}

/**
 * Check Redis → memory → loader. On Redis errors, fall through (fail open).
 * On hit, return parsed JSON. On miss, run loader; setex / memory when cacheable.
 */
export async function cachedPadFeed<T>(
  padId: string,
  phase: string,
  loader: () => Promise<T>,
  opts?: CachedPadFeedOptions<T>,
): Promise<T> {
  return cachedByKey(padCacheKey(padId, phase), loader, opts);
}
