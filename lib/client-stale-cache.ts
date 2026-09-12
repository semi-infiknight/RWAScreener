/**
 * Browser sessionStorage stale-while-revalidate helpers.
 * Paint last-good JSON immediately on reload; background fetch refreshes.
 * Soft TTL keeps data usable across short reloads; hard max age drops garbage.
 */

const PREFIX = "meteora.fyi:v1:";

export type StaleEntry<T> = {
  savedAt: number;
  value: T;
};

function key(name: string): string {
  return PREFIX + name;
}

export function readStale<T>(
  name: string,
  maxAgeMs: number,
): StaleEntry<T> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaleEntry<T>;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      parsed.value === undefined
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      sessionStorage.removeItem(key(name));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStale<T>(name: string, value: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: StaleEntry<T> = { savedAt: Date.now(), value };
    sessionStorage.setItem(key(name), JSON.stringify(entry));
  } catch {
    // private mode / quota — ignore
  }
}

/** Homepage pad metrics map — keep up to 10 minutes across reloads. */
export const HOME_METRICS_CACHE = "home-pad-metrics";
export const HOME_METRICS_MAX_AGE_MS = 10 * 60 * 1000;

/** Live pad token list — keep up to 5 minutes. */
export function padTokensCacheKey(padId: string): string {
  return `pad-tokens:${padId}`;
}
export const PAD_TOKENS_MAX_AGE_MS = 5 * 60 * 1000;
