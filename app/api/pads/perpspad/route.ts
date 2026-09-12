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
    const { source, tokens, kept, droppedExternal, rawCount } =
      await fetchPerpspadTokens({ phase: fast ? "fast" : "full" });
    return NextResponse.json({
      source,
      phase: fast ? "fast" : "full",
      count: tokens.length,
      kept,
      droppedExternal,
      rawCount,
      filter: "native_meteora_dbc_damm_v2",
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Perpspad fetch failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 502 });
  }
}
