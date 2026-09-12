"use client";

import { useEffect, useState } from "react";
import type { TokenRow } from "../../lib/tokens";
import { PadMetrics } from "./pad-metrics";
import { TokenScreener } from "./token-screener";

function padApi(launchpadId: string): string {
  return `/api/pads/${launchpadId}`;
}

function patchToken(
  prev: TokenRow[],
  patch: Partial<TokenRow> & { id?: string; mint?: string },
): TokenRow[] {
  return prev.map((t) => {
    const match =
      (patch.id && t.id === patch.id) || (patch.mint && t.mint === patch.mint);
    if (!match) return t;
    return { ...t, ...patch };
  });
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
  const api = live ? padApi(launchpadId) : null;
  const [tokens, setTokens] = useState<TokenRow[]>(live ? [] : initialTokens);
  const [loading, setLoading] = useState(Boolean(api));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setPending(false);
      try {
        const fastRes = await fetch(`${api}?phase=fast`);
        const fastBody = await fastRes.json().catch(() => ({}));
        if (!fastRes.ok) throw new Error("fetch failed");
        if (cancelled) return;
        const fastTokens: TokenRow[] = Array.isArray(fastBody.tokens)
          ? fastBody.tokens
          : [];
        setPending(Boolean(fastBody.pending) && fastTokens.length === 0);
        setTokens(fastTokens);
        setLoading(false);

        // Only Ethics-style feeds opt into sequential ?mint= enrich.
        // Pads without it (Bags/Ember/ClawPump/…) must not storm the list endpoint.
        if (fastBody.pending || fastTokens.length === 0 || !fastBody.sequential) return;

        const queue = fastTokens.filter((t) => t.mint);
        for (let i = 0; i < queue.length; i++) {
          if (cancelled) break;
          const row = queue[i];
          const mint = row.mint!;
          try {
            const res = await fetch(`${api}?mint=${encodeURIComponent(mint)}`);
            if (res.status === 404) {
              if (i === 0) break;
              continue;
            }
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.token) continue;
            if (cancelled) break;
            setTokens((prev) => patchToken(prev, body.token));
          } catch {
            // skip
          }
        }
      } catch {
        if (cancelled) return;
        setTokens([]);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="live-pad-screener">
      {!pending ? <PadMetrics tokens={tokens} loading={loading} /> : null}
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
