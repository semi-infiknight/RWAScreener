import { NextRequest, NextResponse } from "next/server";
import { fetchPerpspadTokens } from "../../../../lib/perpspad";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Perpspad catalog — same rows for fast/full (no enrich step).
 * Source is TanStack `_serverFn/<hash>` behind perpspad.fun/tokens.
 */
export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const { source, tokens } = await fetchPerpspadTokens();
    return NextResponse.json({
      source,
      phase: fast ? "fast" : "full",
      count: tokens.length,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Perpspad fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
