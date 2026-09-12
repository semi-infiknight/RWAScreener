import { NextRequest, NextResponse } from "next/server";
import { fetchClawPumpTokens } from "../../../../lib/clawpump";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ClawPump public list — fast and full are the same rows (no enrich step).
 * Honors ?phase= for LivePadScreener.
 */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    return NextResponse.json(
      { error: "ClawPump has no per-mint enrich", mint, token: null },
      { status: 404 },
    );
  }
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchClawPumpTokens();
    return NextResponse.json({
      source: "https://clawpump.tech/api/tokens?sort=new&limit=200&offset=&snapshot= (filter launchPlatform===meteora_dbc)",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ClawPump fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
