import { NextResponse } from "next/server";
import { fetchEmberCurveTokens } from "../../../../lib/embercurve";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const tokens = await fetchEmberCurveTokens();
    return NextResponse.json({
      source: "https://embercurve.fun/api/solana/markets",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ember fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
