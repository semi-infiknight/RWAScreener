import { NextRequest, NextResponse } from "next/server";
import { fetchBagsTokens } from "../../../../lib/bags";
import { fetchClawPumpTokens } from "../../../../lib/clawpump";
import { fetchEmberCurveTokens } from "../../../../lib/embercurve";
import { fetchEthicsTokens } from "../../../../lib/ethics";
import { fetchLfgownTokens } from "../../../../lib/lfgown";
import {
  aggregatePadMetrics,
  EMPTY_PAD_AGGREGATE,
  FAILED_PAD_AGGREGATE,
  type PadAggregate,
} from "../../../../lib/pad-aggregates";
import {
  cachedByKey,
  padSummaryCacheKey,
} from "../../../../lib/pad-cache";
import { fetchPerpspadTokens } from "../../../../lib/perpspad";
import { getProject, isScreenerLive, projects } from "../../../../lib/projects";
import { fetchRevShareTokens } from "../../../../lib/revshare";
import type { TokenRow } from "../../../../lib/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUMMARY_CACHE_CONTROL =
  "public, s-maxage=15, stale-while-revalidate=30";

export type PadSummaryRow = PadAggregate & {
  id: string;
  live: boolean;
  ok: boolean;
};

/**
 * Homepage launchpad rollups — parallel fast feeds via existing fetchers + Redis
 * cachedPadFeed. Non-live pads return empty aggregates (UI shows —).
 *
 * ?pad=<id> — single-pad rollup for progressive homepage fill (one at a time).
 * Successful rows also sit in `padsummary:<id>` (same TTL as padfeed) for snappy
 * repeat visits; fetchers still hit padfeed underneath.
 */
async function loadPadTokens(padId: string): Promise<TokenRow[]> {
  switch (padId) {
    case "embercurve":
      return fetchEmberCurveTokens({ phase: "fast" });
    case "lfgown":
      return fetchLfgownTokens({ enrichIcons: false });
    case "bags":
      return fetchBagsTokens({ phase: "fast" });
    case "perpspad": {
      const body = await fetchPerpspadTokens({ phase: "fast" });
      return Array.isArray(body.tokens) ? body.tokens : [];
    }
    case "clawpump":
      return fetchClawPumpTokens({ phase: "fast" });
    case "ethics":
      // ethics:fast — board/enrich mcap+vol + token-info liq (top 24). Same Redis key as pad ?phase=fast.
      return fetchEthicsTokens({ enrichBoard: true, enrichDetails: false });
    case "revshare":
      return fetchRevShareTokens({ phase: "fast" });
    default:
      return [];
  }
}

async function summarizePad(padId: string): Promise<PadSummaryRow> {
  const p = getProject(padId);
  if (!p) {
    return { id: padId, live: false, ok: false, ...FAILED_PAD_AGGREGATE };
  }
  const live = isScreenerLive(p);
  if (!live) {
    return { id: p.id, live: false, ok: true, ...EMPTY_PAD_AGGREGATE };
  }
  try {
    const tokens = await loadPadTokens(p.id);
    // Empty live feed is a flap/fail — never publish coins:0 / 0 / 0.
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return { id: p.id, live: true, ok: false, ...FAILED_PAD_AGGREGATE };
    }
    return {
      id: p.id,
      live: true,
      ok: true,
      ...aggregatePadMetrics(tokens),
    };
  } catch {
    // Do not pin EMPTY zeros — client shows — for null counts.
    return { id: p.id, live: true, ok: false, ...FAILED_PAD_AGGREGATE };
  }
}

/** Cache successful summary rows only (TTL ~25s via pad-cache). */
async function summarizePadCached(padId: string): Promise<PadSummaryRow> {
  return cachedByKey(padSummaryCacheKey(padId), () => summarizePad(padId), {
    shouldCache: (row) => {
      if (!row.ok) return false;
      // Non-live placeholders are fine to cache; skip empty live rollups so a
      // cold/empty upstream flap does not pin coins:0 in Redis.
      if (!row.live) return true;
      return typeof row.coins === "number" && row.coins > 0;
    },
  });
}

function jsonWithCache(body: unknown, cacheable: boolean): NextResponse {
  const res = NextResponse.json(body);
  res.headers.set(
    "Cache-Control",
    cacheable ? SUMMARY_CACHE_CONTROL : "no-store",
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
