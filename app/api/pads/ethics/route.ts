import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import {
  enrichEthicsToken,
  fetchEthicsTokens,
} from "../../../../lib/ethics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ?phase=fast — list + board/enrich mcap/vol + token-info liq (top 24)
 * ?mint=… — single-token detail enrich (price / % / liq)
 * ?phase=full — legacy bulk enrich (avoid; prefer sequential ?mint=)
 */
function jsonCached(body: unknown, ok: boolean, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set(
    "Cache-Control",
    ok ? PAD_JSON_CACHE_CONTROL : PAD_JSON_NO_STORE,
  );
  return res;
}

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    try {
      const patch = await enrichEthicsToken(mint);
      if (!patch) {
        return jsonCached(
          { error: "No token-info for mint", mint, token: null },
          false,
          404,
        );
      }
      return jsonCached({ mint, token: patch }, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ethics mint enrich failed";
      return jsonCached({ error: message, mint, token: null }, false, 502);
    }
  }

  const phase = req.nextUrl.searchParams.get("phase") || "fast";
  const full = phase === "full";
  try {
    const tokens = await fetchEthicsTokens({
      // Board enrich is one POST — safe for homepage + fast pad paint.
      enrichBoard: true,
      enrichDetails: full,
    });
    return jsonCached({
      source: "https://www.ethics.ltd/api/launches (+ board/enrich)",
      phase: full ? "full" : "fast",
      sequential: true,
      count: tokens.length,
      tokens,
    }, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethics fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
