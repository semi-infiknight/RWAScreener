import { NextResponse } from "next/server";
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
import { isScreenerLive, projects } from "../../../../lib/projects";
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

export async function GET() {
  const rows: PadSummaryRow[] = await Promise.all(
    projects.map(async (p) => {
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
    }),
  );

  return NextResponse.json({
    phase: "fast",
    count: rows.length,
    pads: rows,
  });
}
