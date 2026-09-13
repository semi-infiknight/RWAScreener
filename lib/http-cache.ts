/** Shared Cache-Control for successful pad JSON — paint snapshot, refresh quietly. */
export const PAD_JSON_CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

export const PAD_JSON_NO_STORE = "no-store";

/** Headers object for staging / dynamic JSON (no CDN cache). */
export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": PAD_JSON_NO_STORE };
}
