/**
 * Stale-while-revalidate cache for pad feeds + summary rollups.
 *
 * - Redis when REDIS_URL / REDIS_PRIVATE_URL is set (Railway); memory fallback.
 * - Soft TTL (PAD_CACHE_TTL_SECONDS, default 30s): after this, serve last-good
 *   immediately and refresh in the background (shared across all visitors).
 * - Hard TTL (PAD_CACHE_HARD_TTL_SECONDS, default 600s / 10m): drop the key.
 * - Keys: padfeed:<padId>:<phase>, padsummary:<padId>
 * - Envelope: { savedAt, value } — legacy bare JSON still readable.
 * - Never cache empty / pending stubs.
 */

import { createClient, type RedisClientType } from "redis";

export const PAD_CACHE_TTL_DEFAULT_SECONDS = 30;

/** Next production build must not block on Redis (SSG pad pages). */
function isNextBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
export const PAD_CACHE_HARD_TTL_DEFAULT_SECONDS = 600;

type Envelope<T> = { savedAt: number; value: T };
type MemoryEntry = { hardExpiresAt: number; payload: string };

const memory = new Map<string, MemoryEntry>();
/** In-flight refresh/load per key — stampede protection. */
const inflight = new Map<string, Promise<unknown>>();

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;

function softTtlSeconds(): number {
  const raw = process.env.PAD_CACHE_TTL_SECONDS?.trim();
  const n = raw ? Number(raw) : PAD_CACHE_TTL_DEFAULT_SECONDS;
  if (!Number.isFinite(n) || n < 1 || n > 3600) {
    return PAD_CACHE_TTL_DEFAULT_SECONDS;
  }
  return Math.floor(n);
}

function hardTtlSeconds(): number {
  const raw = process.env.PAD_CACHE_HARD_TTL_SECONDS?.trim();
  const soft = softTtlSeconds();
  const n = raw ? Number(raw) : PAD_CACHE_HARD_TTL_DEFAULT_SECONDS;
  if (!Number.isFinite(n) || n < soft || n > 86400) {
    return Math.max(soft * 20, PAD_CACHE_HARD_TTL_DEFAULT_SECONDS);
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

export function padSummaryCacheKey(padId: string): string {
  return `padsummary:${padId}`;
}

async function getRedis(): Promise<RedisClientType | null> {
  if (isNextBuild()) return null;
  const url = redisUrl();
  if (!url) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisConnectPromise) return redisConnectPromise;

  redisConnectPromise = (async () => {
    try {
      const client = createClient({
        url,
        socket: {
          connectTimeout: 1500,
          reconnectStrategy: false,
        },
      });
      client.on("error", () => {});
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("redis connect timeout")), 2000),
        ),
      ]);
      redisClient = client as RedisClientType;
      return redisClient;
    } catch {
      try {
        // abandon half-open client
      } catch {
        /* ignore */
      }
      redisClient = null;
      return null;
    } finally {
      redisConnectPromise = null;
    }
  })();

  return redisConnectPromise;
}

function parseEnvelope<T>(raw: string): Envelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "savedAt" in parsed &&
      "value" in parsed &&
      typeof (parsed as Envelope<T>).savedAt === "number"
    ) {
      return parsed as Envelope<T>;
    }
    // Legacy bare payload — treat as immediately soft-stale so we refresh.
    return { savedAt: 0, value: parsed as T };
  } catch {
    return null;
  }
}

function memoryRead<T>(key: string): Envelope<T> | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.hardExpiresAt) {
    memory.delete(key);
    return null;
  }
  return parseEnvelope<T>(entry.payload);
}

function memoryWrite(key: string, envelope: Envelope<unknown>, hardSec: number): void {
  memory.set(key, {
    hardExpiresAt: Date.now() + hardSec * 1000,
    payload: JSON.stringify(envelope),
  });
}

async function redisRead<T>(key: string): Promise<Envelope<T> | null> {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const hit = await redis.get(key);
    if (hit == null) return null;
    return parseEnvelope<T>(hit);
  } catch {
    return null;
  }
}

async function redisWrite(
  key: string,
  envelope: Envelope<unknown>,
  hardSec: number,
): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.setEx(key, hardSec, JSON.stringify(envelope));
  } catch {
    // fail open
  }
}

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

function isFresh(savedAt: number, softSec: number): boolean {
  return Date.now() - savedAt < softSec * 1000;
}

async function storeValue<T>(
  key: string,
  value: T,
  shouldCache: (value: T) => boolean,
): Promise<void> {
  if (!shouldCache(value)) return;
  const hard = hardTtlSeconds();
  const envelope: Envelope<T> = { savedAt: Date.now(), value };
  memoryWrite(key, envelope, hard);
  await redisWrite(key, envelope, hard);
}

async function runLoader<T>(
  key: string,
  loader: () => Promise<T>,
  shouldCache: (value: T) => boolean,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      await storeValue(key, value, shouldCache);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Peek last-good within hard TTL — never hits upstream.
 * Used to SSR-seed homepage / pad pages for every visitor.
 */
export async function peekByKey<T>(key: string): Promise<T | undefined> {
  const fromRedis = await redisRead<T>(key);
  if (fromRedis) return fromRedis.value;
  const fromMem = memoryRead<T>(key);
  if (fromMem) return fromMem.value;
  return undefined;
}

export async function peekPadFeed<T>(
  padId: string,
  phase: string,
): Promise<T | undefined> {
  return peekByKey(padCacheKey(padId, phase));
}

export async function peekPadSummary<T>(padId: string): Promise<T | undefined> {
  return peekByKey(padSummaryCacheKey(padId));
}

/**
 * Soft-fresh → return.
 * Soft-stale but hard-present → return immediately + background refresh.
 * Miss → await loader (first visitor / cold hard expiry).
 */
export async function cachedByKey<T>(
  key: string,
  loader: () => Promise<T>,
  opts?: CachedPadFeedOptions<T>,
): Promise<T> {
  const soft = softTtlSeconds();
  const shouldCache = opts?.shouldCache ?? defaultPadCacheable;

  const hit =
    (await redisRead<T>(key)) ?? memoryRead<T>(key) ?? null;

  if (hit) {
    if (isFresh(hit.savedAt, soft)) {
      return hit.value;
    }
    // Stale-while-revalidate: paint last-good for this visitor + everyone else.
    void runLoader(key, loader, shouldCache).catch(() => {});
    return hit.value;
  }

  return runLoader(key, loader, shouldCache);
}

export async function cachedPadFeed<T>(
  padId: string,
  phase: string,
  loader: () => Promise<T>,
  opts?: CachedPadFeedOptions<T>,
): Promise<T> {
  return cachedByKey(padCacheKey(padId, phase), loader, opts);
}
