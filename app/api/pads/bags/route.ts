import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { fetchBagsTokens } from "../../../../lib/bags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Bags has no separate enrich step — fast and full return the same rows
 * (identity + icons; USD metrics null). Honors ?phase= for LivePadScreener.
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
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchBagsTokens({ phase: fast ? "fast" : "full" });
    return jsonCached({
      source:
        "https://public-api-v2.bags.fm/api/v1/token-launch/damm-v2/launches?quoteMint=<xStock>",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    }, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bags fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
