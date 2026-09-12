import { NextResponse } from "next/server";
import { fetchEthicsTokens } from "../../../../lib/ethics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const tokens = await fetchEthicsTokens();
    return NextResponse.json({
      source: "https://www.ethics.ltd/api/launches (+ board/enrich)",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethics fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
