import { NextRequest, NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import {
  summarizePadCached,
  type PadSummaryRow,
} from "../../../../lib/pad-summary";
import { projects } from "../../../../lib/projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Homepage launchpad rollups — Redis soft/hard SWR via summarizePadCached.
 * ?pad=<id> for progressive fill; bare GET returns all pads.
 */
function jsonWithCache(body: unknown, cacheable: boolean): NextResponse {
  const res = NextResponse.json(body);
  res.headers.set(
    "Cache-Control",
    cacheable ? PAD_JSON_CACHE_CONTROL : PAD_JSON_NO_STORE,
  );
  return res;
}

export async function GET(req: NextRequest) {
  const padId = req.nextUrl.searchParams.get("pad")?.trim();
  if (padId) {
    const row = await summarizePadCached(padId);
    return jsonWithCache(
      {
        phase: "fast",
        pad: row,
      },
      row.ok,
    );
  }

  const rows: PadSummaryRow[] = await Promise.all(
    projects.map((p) => summarizePadCached(p.id)),
  );

  return jsonWithCache(
    {
      phase: "fast",
      count: rows.length,
      pads: rows,
    },
    rows.every((r) => r.ok),
  );
}
