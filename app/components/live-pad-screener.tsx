"use client";

import { useEffect, useState } from "react";
import type { TokenRow } from "../../lib/tokens";
import { TokenScreener } from "./token-screener";

function padApi(launchpadId: string): string {
  return `/api/pads/${launchpadId}`;
}

function patchToken(prev: TokenRow[], patch: Partial<TokenRow> & { id?: string; mint?: string }): TokenRow[] {
  const key = patch.id || (patch.mint ? undefined : undefined);
  return prev.map((t) => {
    const match =
      (patch.id && t.id === patch.id) ||
      (patch.mint && t.mint === patch.mint);
    if (!match) return t;
    return { ...t, ...patch };
  });
}

/**
 * Universal live-pad screener: never blocks SSR.
 * Fast list first, then enrich ONE mint at a time (paint after each).
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
  const [tokens, setTokens] = useState<TokenRow[]>(live ? [] : initialTokens);
  const [loading, setLoading] = useState(Boolean(api));
  const [enriching, setEnriching] = useState(false);
  const [enrichLabel, setEnrichLabel] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPending(false);
      setEnrichLabel(null);
      try {
        const fastRes = await fetch(`${api}?phase=fast`);
        const fastBody = await fastRes.json().catch(() => ({}));
        if (!fastRes.ok) {
          throw new Error(
            (fastBody as { error?: string })?.error || `HTTP ${fastRes.status}`,
          );
        }
        if (cancelled) return;
        const fastTokens: TokenRow[] = Array.isArray(fastBody.tokens)
          ? fastBody.tokens
          : [];
        setPending(Boolean(fastBody.pending) && fastTokens.length === 0);
        setTokens(fastTokens);
        setLoading(false);

        if (fastBody.pending || fastTokens.length === 0) {
          setEnriching(false);
          return;
        }

        // Sequential one-by-one enrich (supports ?mint=). Skip if pad returns 404.
        setEnriching(true);
        const queue = fastTokens.filter((t) => t.mint);
        for (let i = 0; i < queue.length; i++) {
          if (cancelled) break;
          const row = queue[i];
          const mint = row.mint!;
          setEnrichLabel(
            `${row.symbol || mint.slice(0, 6)} (${i + 1}/${queue.length})`,
          );
          try {
            const res = await fetch(
              `${api}?mint=${encodeURIComponent(mint)}`,
            );
            if (res.status === 404) {
              // Pad does not support per-mint enrich — stop sequential loop once.
              if (i === 0) break;
              continue;
            }
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.token) continue;
            if (cancelled) break;
            setTokens((prev) => patchToken(prev, body.token));
          } catch {
            // skip this mint, continue
          }
        }
        if (!cancelled) {
          setEnriching(false);
          setEnrichLabel(null);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tokens");
        setTokens([]);
        setLoading(false);
        setEnriching(false);
        setEnrichLabel(null);
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
      {enriching && enrichLabel ? (
        <p className="live-pad-status">Updating {enrichLabel}…</p>
      ) : null}
      {error && !loading && tokens.length === 0 ? (
        <p className="live-pad-status error">
          Couldn’t load live feed ({error}).
        </p>
      ) : null}
      <TokenScreener
        launchpadId={launchpadId}
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
