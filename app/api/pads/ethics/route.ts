import { NextRequest, NextResponse } from "next/server";
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
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    try {
      const patch = await enrichEthicsToken(mint);
      if (!patch) {
        return NextResponse.json(
          { error: "No token-info for mint", mint, token: null },
          { status: 404 },
        );
      }
      return NextResponse.json({ mint, token: patch });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ethics mint enrich failed";
      return NextResponse.json({ error: message, mint, token: null }, { status: 502 });
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
    return NextResponse.json({
      source: "https://www.ethics.ltd/api/launches (+ board/enrich)",
      phase: full ? "full" : "fast",
      sequential: true,
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethics fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
