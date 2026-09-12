import { NextRequest, NextResponse } from "next/server";
import { fetchBagsTokens } from "../../../../lib/bags";
import { fetchClawPumpTokens } from "../../../../lib/clawpump";
import { fetchEmberCurveTokens } from "../../../../lib/embercurve";
import { fetchEthicsTokens } from "../../../../lib/ethics";
import { fetchLfgownTokens } from "../../../../lib/lfgown";
import {
  aggregatePadMetrics,
  EMPTY_PAD_AGGREGATE,
  type PadAggregate,
} from "../../../../lib/pad-aggregates";
import { fetchPerpspadTokens } from "../../../../lib/perpspad";
import { getProject, isScreenerLive, projects } from "../../../../lib/projects";
import { fetchRevShareTokens } from "../../../../lib/revshare";
import type { TokenRow } from "../../../../lib/tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      // Match /api/pads/ethics?phase=fast so Redis key hits (board enrich on).
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
    return { id: padId, live: false, ok: false, ...EMPTY_PAD_AGGREGATE };
  }
  const live = isScreenerLive(p);
  if (!live) {
    return { id: p.id, live: false, ok: true, ...EMPTY_PAD_AGGREGATE };
  }
  try {
    const tokens = await loadPadTokens(p.id);
    return {
      id: p.id,
      live: true,
      ok: true,
      ...aggregatePadMetrics(tokens),
    };
  } catch {
    return { id: p.id, live: true, ok: false, ...EMPTY_PAD_AGGREGATE };
  }
}

export async function GET(req: NextRequest) {
  const padId = req.nextUrl.searchParams.get("pad")?.trim();
  if (padId) {
    const row = await summarizePad(padId);
    return NextResponse.json({
      phase: "fast",
      pad: row,
    });
  }

  const rows: PadSummaryRow[] = await Promise.all(
    projects.map((p) => summarizePad(p.id)),
  );

  return NextResponse.json({
    phase: "fast",
    count: rows.length,
    pads: rows,
  });
}
