import { NextRequest, NextResponse } from "next/server";
import {
  enrichLfgownToken,
  fetchLfgownTokens,
} from "../../../../lib/lfgown";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * LFOwn live pad — DBC verified.
 * Bonding/on-curve vs MetaDAO quote; graduated = DAMM v2 (isMigrated).
 * ?phase=fast — identity + status + raised-USD (fdv) + progress (rangePos) + age (no uri icons)
 * ?mint=… — single-token icon enrich from launch.uri metadata
 * ?phase=full — list + concurrent uri→image icons
 */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    try {
      const patch = await enrichLfgownToken(mint);
      if (!patch) {
        return NextResponse.json(
          { error: "No LFOwn launch for mint", mint, token: null },
          { status: 404 },
        );
      }
      return NextResponse.json({ mint, token: patch });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "LFOwn mint enrich failed";
      return NextResponse.json(
        { error: message, mint, token: null },
        { status: 502 },
      );
    }
  }

  const phase = req.nextUrl.searchParams.get("phase") || "fast";
  const full = phase === "full";
  try {
    const tokens = await fetchLfgownTokens({ enrichIcons: full });
    return NextResponse.json({
      source: "https://letsfuckingown.fun/api/launches (+ uri metadata.image)",
      phase: full ? "full" : "fast",
      sequential: true,
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "LFOwn fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
