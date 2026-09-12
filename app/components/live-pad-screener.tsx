"use client";

import { useEffect, useState } from "react";
import type { TokenRow } from "../../lib/tokens";
import { TokenScreener } from "./token-screener";

/** Pads whose tokens are fetched live from /api/pads/<id> (never block SSR). */
const LIVE_PAD_API: Record<string, string> = {
  ethics: "/api/pads/ethics",
  embercurve: "/api/pads/embercurve",
  bags: "/api/pads/bags",
};

function mergeById(prev: TokenRow[], next: TokenRow[]): TokenRow[] {
  if (prev.length === 0) return next;
  const map = new Map(prev.map((t) => [t.id, t]));
  for (const t of next) map.set(t.id, { ...map.get(t.id), ...t });
  // Keep next order (usually volume-ranked)
  const order = next.map((t) => t.id);
  const seen = new Set(order);
  const merged = order.map((id) => map.get(id)!);
  for (const t of prev) {
    if (!seen.has(t.id)) merged.push(t);
  }
  return merged;
}

export function LivePadScreener({
  launchpadId,
  launchpadName,
  initialTokens,
  live = true,
  ecosystemName,
}: {
  launchpadId: string;
  launchpadName: string;
  initialTokens: TokenRow[];
  live?: boolean;
  ecosystemName?: string;
}) {
  const api = LIVE_PAD_API[launchpadId];
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens);
  const [loading, setLoading] = useState(Boolean(api) && live);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !live) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Phase 1 — fast list (icons + mcap/vol) so rows appear ASAP
        const fastRes = await fetch(`${api}?phase=fast`);
        const fastBody = await fastRes.json();
        if (!fastRes.ok) {
          throw new Error(fastBody?.error || `HTTP ${fastRes.status}`);
        }
        if (cancelled) return;
        const fastTokens = Array.isArray(fastBody.tokens) ? fastBody.tokens : [];
        setTokens(fastTokens);
        setLoading(false);

        // Phase 2 — enrich prices/% (optional; pads without phase support just re-fetch)
        setEnriching(true);
        try {
          const fullRes = await fetch(`${api}?phase=full`);
          const fullBody = await fullRes.json();
          if (!cancelled && fullRes.ok && Array.isArray(fullBody.tokens)) {
            setTokens((prev) => mergeById(prev, fullBody.tokens));
          }
        } catch {
          // keep fast rows
        } finally {
          if (!cancelled) setEnriching(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tokens");
        setLoading(false);
        setEnriching(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, live]);

  return (
    <div className="live-pad-screener">
      {loading ? (
        <p className="live-pad-status">Loading live tokens…</p>
      ) : null}
      {enriching && tokens.length > 0 ? (
        <p className="live-pad-status">Updating prices…</p>
      ) : null}
      {error && !loading && tokens.length === 0 ? (
        <p className="live-pad-status error">
          Couldn’t load live feed ({error}).
        </p>
      ) : null}
      <TokenScreener
        launchpadName={launchpadName}
        tokens={tokens}
        live={live}
        loading={loading}
        ecosystemName={ecosystemName}
      />
    </div>
  );
}
