import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { fetchOtcDesksTokens } from "../../../../lib/otcdesks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * OTC Desks public /api/coins — Meteora DBC only (venue === "meteora").
 * Honors ?phase= for LivePadScreener.
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
    return NextResponse.json(
      { error: "OTC Desks has no per-mint enrich", mint, token: null },
      { status: 404 },
    );
  }
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchOtcDesksTokens({ phase: fast ? "fast" : "full" });
    return jsonCached(
      {
        source:
          "https://otcdesks.cash/api/coins (venue===meteora Meteora DBC filter)",
        phase: fast ? "fast" : "full",
        count: tokens.length,
        tokens,
      },
      true,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OTC Desks fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
