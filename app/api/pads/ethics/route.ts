import { NextRequest, NextResponse } from "next/server";
import { fetchEthicsTokens } from "../../../../lib/ethics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ?phase=fast — launches + board/enrich only (icons, mcap, vol)
 * ?phase=full (default) — also token-info price/% for top volume mints
 */
export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const enrichDetails = phase !== "fast";
  try {
    const tokens = await fetchEthicsTokens({ enrichDetails });
    return NextResponse.json({
      source: "https://www.ethics.ltd/api/launches (+ board/enrich)",
      phase: enrichDetails ? "full" : "fast",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethics fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
