import { NextRequest, NextResponse } from "next/server";
import { fetchRevShareTokens } from "../../../../lib/revshare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * RevShare public all-tokens — Solana Meteora DBC only (client filter).
 * Metrics merged from /api/projects + /api/trending-tokens (all-tokens mcap often 0).
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
        "https://app.revshare.ltd/api/all-tokens (+ /api/projects + /api/trending-tokens; Meteora DBC filter)",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "RevShare fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
