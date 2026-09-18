import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { fetchPurpsTokens } from "../../../../lib/purps";

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
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    return NextResponse.json(
      { error: "Purps has no per-mint enrich", mint, token: null },
      { status: 404 },
    );
  }
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchPurpsTokens({ phase: fast ? "fast" : "full" });
    return jsonCached(
      {
        source:
          "https://purps.lol/api/public/coins (origin launchpad|meteora, chain=solana)",
        phase: fast ? "fast" : "full",
        count: tokens.length,
        tokens,
      },
      true,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purps fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
