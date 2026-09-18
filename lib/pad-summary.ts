/**
 * Homepage launchpad rollups — shared by /api/pads/summary and SSR peek.
 */
// import { fetchBagsTokens } from "./bags";
import { fetchClawPumpTokens } from "./clawpump";
import { fetchEmberCurveTokens } from "./embercurve";
import { fetchEthicsTokens } from "./ethics";
import { fetchLfgownTokens } from "./lfgown";
import {
  aggregatePadMetrics,
  EMPTY_PAD_AGGREGATE,
  FAILED_PAD_AGGREGATE,
  type PadAggregate,
} from "./pad-aggregates";
import {
  cachedByKey,
  padSummaryCacheKey,
  peekPadSummary,
} from "./pad-cache";
import { fetchPerpspadTokens } from "./perpspad";
import { getProject, isScreenerLive, projects } from "./projects";
import { fetchOtcDesksTokens } from "./otcdesks";
import { fetchPurpsTokens } from "./purps";
import { fetchRevShareTokens } from "./revshare";
import { fetchStonkOptionsTokens } from "./stonkoptions";
import { fetchTrendsTokens } from "./trends";
import type { TokenRow } from "./tokens";

export type PadSummaryRow = PadAggregate & {
  id: string;
  live: boolean;
  ok: boolean;
};

async function loadPadTokens(padId: string): Promise<TokenRow[]> {
  switch (padId) {
    case "embercurve":
      return fetchEmberCurveTokens({ phase: "fast" });
    case "lfgown":
      return fetchLfgownTokens({ enrichIcons: false });
    // Bags: not DBC — keep fetchBagsTokens for /api/pads/bags, not homepage.
    // case "bags":
    //   return fetchBagsTokens({ phase: "fast" });
    case "purps":
      return fetchPurpsTokens({ phase: "fast" });
    case "trends":
      return fetchTrendsTokens({ phase: "fast" });
    case "perpspad": {
      const body = await fetchPerpspadTokens({ phase: "fast" });
      return Array.isArray(body.tokens) ? body.tokens : [];
    }
    case "clawpump":
      return fetchClawPumpTokens({ phase: "fast" });
    case "ethics":
      return fetchEthicsTokens({ enrichBoard: true, enrichDetails: false });
    case "revshare":
      return fetchRevShareTokens({ phase: "fast" });
    case "otcdesks":
      return fetchOtcDesksTokens({ phase: "fast" });
    case "stardotfun":
      return fetchStonkOptionsTokens({ phase: "fast" });
    default:
      return [];
  }
}

export async function summarizePad(padId: string): Promise<PadSummaryRow> {
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
    return { id: p.id, live: true, ok: false, ...FAILED_PAD_AGGREGATE };
  }
}

export async function summarizePadCached(padId: string): Promise<PadSummaryRow> {
  return cachedByKey(padSummaryCacheKey(padId), () => summarizePad(padId), {
    shouldCache: (row) => {
      if (!row.ok) return false;
      if (!row.live) return true;
      return typeof row.coins === "number" && row.coins > 0;
    },
  });
}

/** SSR seed: last-good Redis/memory only — never blocks on upstream. */
export async function peekHomePadMetrics(): Promise<
  Record<string, PadAggregate>
> {
  const out: Record<string, PadAggregate> = {};
  await Promise.all(
    projects.map(async (p) => {
      if (!isScreenerLive(p)) return;
      const row = await peekPadSummary<PadSummaryRow>(p.id);
      if (!row || !row.ok) return;
      out[p.id] = {
        coins: row.coins,
        bonding: row.bonding,
        graduated: row.graduated,
        mcapUsd: row.mcapUsd,
        volume24hUsd: row.volume24hUsd,
        liquidityUsd: row.liquidityUsd,
      };
    }),
  );
  return out;
}
