import { NextRequest, NextResponse } from "next/server";
import { fetchEmberCurveTokens } from "../../../../lib/embercurve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchEmberCurveTokens({
      phase: fast ? "fast" : "full",
    });
    return NextResponse.json({
      source: "https://embercurve.fun/api/solana/markets",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ember fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
