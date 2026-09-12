import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { fetchEmberCurveTokens } from "../../../../lib/embercurve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const tokens = await fetchEmberCurveTokens({
      phase: fast ? "fast" : "full",
    });
    return jsonCached({
      source: "https://embercurve.fun/api/solana/markets",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    }, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ember fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
