import { NextRequest, NextResponse } from "next/server";
import { fetchEthicsTokens } from "../../../../lib/ethics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ?phase=fast — launches + board only (icons, partial mcap/vol) — first paint
 * ?phase=full (default) — + enrich + token-info price/%
 */
export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchEthicsTokens({
      enrichBoard: !fast,
      enrichDetails: !fast,
    });
    return NextResponse.json({
      source: "https://www.ethics.ltd/api/launches (+ board/enrich)",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethics fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
