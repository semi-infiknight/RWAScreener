import { NextResponse } from "next/server";
import { fetchBagsTokens } from "../../../../lib/bags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const tokens = await fetchBagsTokens();
    return NextResponse.json({
      source:
        "https://public-api-v2.bags.fm/api/v1/token-launch/damm-v2/launches?quoteMint=<xStock>",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bags fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
