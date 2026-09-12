"use client";

import { useEffect, useState } from "react";
import type { TokenRow } from "../../lib/tokens";
import { TokenScreener } from "./token-screener";

function padApi(launchpadId: string): string {
  return `/api/pads/${launchpadId}`;
}

function mergeById(prev: TokenRow[], next: TokenRow[]): TokenRow[] {
  if (prev.length === 0) return next;
  const map = new Map(prev.map((t) => [t.id, t]));
  for (const t of next) map.set(t.id, { ...map.get(t.id), ...t });
  const order = next.map((t) => t.id);
  const seen = new Set(order);
  const merged = order.map((id) => map.get(id)!);
  for (const t of prev) {
    if (!seen.has(t.id)) merged.push(t);
  }
  return merged;
}

/**
 * Universal live-pad screener: never blocks SSR.
 * - live=false (StonkOptions only) → Not live yet empty state
 * - live=true → skeleton, then ?phase=fast rows, then ?phase=full enrich
 */
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
  const api = live ? padApi(launchpadId) : null;
  // Live pads start empty + skeleton (ignore static seed) so loading never flashes stubs.
  const [tokens, setTokens] = useState<TokenRow[]>(live ? [] : initialTokens);
  const [loading, setLoading] = useState(Boolean(api));
  const [enriching, setEnriching] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPending(false);
      try {
        const fastRes = await fetch(`${api}?phase=fast`);
        const fastBody = await fastRes.json().catch(() => ({}));
        if (!fastRes.ok) {
          throw new Error(
            (fastBody as { error?: string })?.error || `HTTP ${fastRes.status}`,
          );
        }
        if (cancelled) return;
        const fastTokens = Array.isArray(fastBody.tokens) ? fastBody.tokens : [];
        setPending(Boolean(fastBody.pending) && fastTokens.length === 0);
        setTokens(fastTokens);
        setLoading(false);

        // Phase 2 enrich (pads that ignore phase just return the same payload)
        if (fastBody.pending) {
          setEnriching(false);
          return;
        }
        setEnriching(true);
        try {
          const fullRes = await fetch(`${api}?phase=full`);
          const fullBody = await fullRes.json().catch(() => ({}));
          if (!cancelled && fullRes.ok && Array.isArray(fullBody.tokens)) {
            setTokens((prev) => mergeById(prev, fullBody.tokens));
            setPending(Boolean(fullBody.pending) && fullBody.tokens.length === 0);
          }
        } catch {
          // keep fast rows
        } finally {
          if (!cancelled) setEnriching(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tokens");
        setTokens([]);
        setLoading(false);
        setEnriching(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api]);

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
        feedPending={pending}
        ecosystemName={ecosystemName}
      />
    </div>
  );
}
