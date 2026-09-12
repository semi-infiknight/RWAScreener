import { NextRequest, NextResponse } from "next/server";
import { fetchRevShareTokens } from "../../../../lib/revshare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * RevShare public all-tokens — Solana Meteora DBC only (client filter).
 * fast and full are the same rows (no enrich step).
 * Honors ?phase= for LivePadScreener.
 */
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint")?.trim();
  if (mint) {
    return NextResponse.json(
      { error: "RevShare has no per-mint enrich", mint, token: null },
      { status: 404 },
    );
  }
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchRevShareTokens({ phase: fast ? "fast" : "full" });
    return NextResponse.json({
      source:
        "https://app.revshare.ltd/api/all-tokens?limit=100&order=newest&chain_id=0 (+cursor; filter bonding_config base58 Meteora DBC)",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "RevShare fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
