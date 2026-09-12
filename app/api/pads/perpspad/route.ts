import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { fetchPerpspadTokens } from "../../../../lib/perpspad";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Perpspad catalog — same rows for fast/full (no enrich step).
 * Source is TanStack `_serverFn/<hash>` behind perpspad.fun/tokens.
 */
function jsonCached(body: unknown, ok: boolean, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set(
    "Cache-Control",
    ok ? PAD_JSON_CACHE_CONTROL : PAD_JSON_NO_STORE,
  );
  return res;
}

export async function GET(req: NextRequest) {
  const phase = req.nextUrl.searchParams.get("phase") || "full";
  const fast = phase === "fast";
  try {
    const { source, tokens, kept, droppedExternal, rawCount } =
      await fetchPerpspadTokens({ phase: fast ? "fast" : "full" });
    return jsonCached({
      source,
      phase: fast ? "fast" : "full",
      count: tokens.length,
      kept,
      droppedExternal,
      rawCount,
      filter: "native_meteora_dbc_damm_v2",
      tokens,
    }, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Perpspad fetch failed";
    return jsonCached({ error: message, tokens: [] }, false, 502);
  }
}
