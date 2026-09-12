import { NextRequest, NextResponse } from "next/server";
import { fetchBagsTokens } from "../../../../lib/bags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Bags has no separate enrich step — fast and full return the same rows
 * (identity + icons; USD metrics null). Honors ?phase= for LivePadScreener.
 */
export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const tokens = await fetchBagsTokens({ phase: fast ? "fast" : "full" });
    return NextResponse.json({
      source:
        "https://public-api-v2.bags.fm/api/v1/token-launch/damm-v2/launches?quoteMint=<xStock>",
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bags fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
