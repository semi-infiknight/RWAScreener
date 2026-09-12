"use client";

import { useEffect, useState } from "react";
import type { TokenRow } from "../../lib/tokens";
import { TokenScreener } from "./token-screener";

/** Pads whose tokens are fetched live from /api/pads/<id> (never block SSR). */
const LIVE_PAD_API: Record<string, string> = {
  ethics: "/api/pads/ethics",
  embercurve: "/api/pads/embercurve",
};

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api || !live) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(api)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        return body as { tokens?: TokenRow[] };
      })
      .then((body) => {
        if (cancelled) return;
        setTokens(Array.isArray(body.tokens) ? body.tokens : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tokens");
        setTokens([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, live]);

  return (
    <div className="live-pad-screener">
      {loading ? (
        <p className="live-pad-status">Loading live tokens…</p>
      ) : null}
      {error && !loading ? (
        <p className="live-pad-status error">Couldn’t refresh live feed ({error}).</p>
      ) : null}
      <TokenScreener
        launchpadName={launchpadName}
        tokens={tokens}
        live={live}
        ecosystemName={ecosystemName}
      />
    </div>
  );
}
