"use client";

import { useEffect, useRef, useState } from "react";
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

function applyPatches(
  prev: TokenRow[],
  patches: Array<Partial<TokenRow> & { id?: string; mint?: string }>,
): TokenRow[] {
  if (patches.length === 0) return prev;
  let next = prev;
  for (const p of patches) next = patchToken(next, p);
  return next;
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
  const pendingPatches = useRef<
    Array<Partial<TokenRow> & { id?: string; mint?: string }>
  >([]);
  const flushRaf = useRef<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const ac = new AbortController();

    function flushPatches() {
      flushRaf.current = null;
      if (cancelled || pendingPatches.current.length === 0) return;
      const batch = pendingPatches.current;
      pendingPatches.current = [];
      setTokens((prev) => applyPatches(prev, batch));
    }

    function queuePatch(patch: Partial<TokenRow> & { id?: string; mint?: string }) {
      pendingPatches.current.push(patch);
      if (flushRaf.current == null) {
        flushRaf.current = requestAnimationFrame(flushPatches);
      }
    }

    async function load() {
      setLoading(true);
      setPending(false);
      pendingPatches.current = [];
      try {
        const fastRes = await fetch(`${api}?phase=fast`, { signal: ac.signal });
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
        // Pads without it (Bags/Ember/ClawPump/RevShare/…) must not storm the list endpoint.
        if (fastBody.pending || fastTokens.length === 0 || !fastBody.sequential) return;

        const queue = fastTokens.filter((t) => t.mint);
        // Concurrency 1 keeps Ethics enrich ordered/correct; abort + rAF batch keeps UI scroll-safe.
        for (let i = 0; i < queue.length; i++) {
          if (cancelled) break;
          const row = queue[i];
          const mint = row.mint!;
          try {
            const res = await fetch(`${api}?mint=${encodeURIComponent(mint)}`, {
              signal: ac.signal,
            });
            if (res.status === 404) {
              if (i === 0) break;
              continue;
            }
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.token) continue;
            if (cancelled) break;
            queuePatch(body.token);
          } catch (err) {
            if (cancelled || (err instanceof DOMException && err.name === "AbortError")) {
              break;
            }
            // skip transient errors
          }
        }
        if (!cancelled) flushPatches();
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setTokens([]);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
      if (flushRaf.current != null) {
        cancelAnimationFrame(flushRaf.current);
        flushRaf.current = null;
      }
      pendingPatches.current = [];
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
