import fs from "node:fs";
import { CUTOFF_MS, DBC_021_CUTOFF_ISO } from "./constants";
import {
  isAllowedQuoteMint,
  loadLaunchpadLabels,
  loadQuoteAllowlist,
} from "./allowlist";
import { dataPath } from "./paths";
import { normalizeStagingStatus } from "./status";
import type {
  StagingLaunch,
  StagingLaunchpad,
  StagingListMeta,
  StagingQuote,
  StagingSource,
} from "./types";

type BackfillPool = {
  address: string;
  config: string;
  base_mint: string;
  quote_mint: string;
  creator?: string | null;
  activation_at?: string | null;
  created_at: string;
  status?: string;
  raw?: { migration_progress?: number | null; is_migrated?: number | null };
};

type BackfillConfig = {
  address: string;
  quote_mint: string;
  fee_claimer?: string | null;
  first_seen_at?: string;
};

type BackfillFile = {
  generated_at?: string;
  pools?: BackfillPool[];
  configs?: BackfillConfig[];
  fee_claimer_labels?: Record<string, string | { label?: string; website?: string | null }>;
};

function readBackfill(): BackfillFile | null {
  const file = dataPath("dbc-backfill-result.json");
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as BackfillFile;
  } catch {
    return null;
  }
}

function afterCutoff(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= CUTOFF_MS;
}

function buildSymbolMap(): Map<string, string> {
  return new Map(loadQuoteAllowlist().map((q) => [q.mint, q.symbol]));
}

function mergeLabels(
  fromFile: BackfillFile | null,
): Record<string, { label: string; website: string | null }> {
  const out: Record<string, { label: string; website: string | null }> = {};
  const seeded = loadLaunchpadLabels();
  for (const [k, v] of Object.entries(seeded)) {
    out[k] = { label: v.label, website: v.website ?? null };
  }
  if (fromFile?.fee_claimer_labels) {
    for (const [k, v] of Object.entries(fromFile.fee_claimer_labels)) {
      const label =
        typeof v === "string"
          ? v
          : v && typeof v === "object" && typeof (v as { label?: string }).label === "string"
            ? (v as { label: string }).label
            : null;
      if (!label) continue;
      const website =
        v && typeof v === "object"
          ? ((v as { website?: string | null }).website ?? null)
          : null;
      if (!out[k]) out[k] = { label, website };
      else if (website && !out[k].website) out[k].website = website;
    }
  }
  return out;
}

export type FileBundle = {
  source: StagingSource;
  generated_at: string | null;
  launches: StagingLaunch[];
  launchpads: StagingLaunchpad[];
  quotes: StagingQuote[];
  allowlist_count: number;
};

export function loadFileBundle(): FileBundle {
  const allowlist = loadQuoteAllowlist();
  const allowlist_count = allowlist.length;
  const backfill = readBackfill();
  if (!backfill) {
    return {
      source: "empty",
      generated_at: null,
      launches: [],
      launchpads: [],
      quotes: allowlist.map((q) => ({
        mint: q.mint,
        symbol: q.symbol,
        name: q.name,
        badge_verified_at: q.badge_verified_at,
        pool_count: 0,
        last_launch_at: null,
      })),
      allowlist_count,
    };
  }

  const symbols = buildSymbolMap();
  const labels = mergeLabels(backfill);
  const configs = new Map(
    (backfill.configs ?? []).map((c) => [c.address, c] as const),
  );

  const pools = (backfill.pools ?? []).filter(
    (p) =>
      isAllowedQuoteMint(p.quote_mint) &&
      afterCutoff(p.created_at || p.activation_at),
  );

  const launches: StagingLaunch[] = pools
    .map((p) => {
      const cfg = configs.get(p.config);
      const fee = cfg?.fee_claimer ?? null;
      return {
        address: p.address,
        config: p.config,
        base_mint: p.base_mint,
        quote_mint: p.quote_mint,
        quote_symbol: symbols.get(p.quote_mint) ?? null,
        creator: p.creator ?? null,
        fee_claimer: fee,
        launchpad_label: fee ? labels[fee]?.label ?? null : null,
        activation_at: p.activation_at ?? null,
        created_at: p.created_at,
        status: normalizeStagingStatus(p.status, p.raw),
      };
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  type Agg = {
    fee_claimer: string;
    pool_count: number;
    configs: Set<string>;
    quotes: Set<string>;
    first: string | null;
    last: string | null;
    sample_symbols: string[];
  };
  const byClaimer = new Map<string, Agg>();
  for (const launch of launches) {
    const key = launch.fee_claimer || "unknown";
    let agg = byClaimer.get(key);
    if (!agg) {
      agg = {
        fee_claimer: key,
        pool_count: 0,
        configs: new Set(),
        quotes: new Set(),
        first: null,
        last: null,
        sample_symbols: [],
      };
      byClaimer.set(key, agg);
    }
    agg.pool_count += 1;
    agg.configs.add(launch.config);
    agg.quotes.add(launch.quote_mint);
    if (!agg.first || Date.parse(launch.created_at) < Date.parse(agg.first)) {
      agg.first = launch.created_at;
    }
    if (!agg.last || Date.parse(launch.created_at) > Date.parse(agg.last)) {
      agg.last = launch.created_at;
    }
    const sym = launch.quote_symbol;
    if (sym && !agg.sample_symbols.includes(sym) && agg.sample_symbols.length < 8) {
      agg.sample_symbols.push(sym);
    }
  }

  const launchpads: StagingLaunchpad[] = [...byClaimer.values()]
    .map((a) => ({
      fee_claimer: a.fee_claimer,
      label: a.fee_claimer !== "unknown" ? labels[a.fee_claimer]?.label ?? null : null,
      website:
        a.fee_claimer !== "unknown" ? labels[a.fee_claimer]?.website ?? null : null,
      pool_count: a.pool_count,
      config_count: a.configs.size,
      quote_mint_count: a.quotes.size,
      first_seen_at: a.first,
      last_seen_at: a.last,
      sample_quote_symbols: a.sample_symbols,
    }))
    .sort((a, b) => b.pool_count - a.pool_count || (b.last_seen_at || "").localeCompare(a.last_seen_at || ""));

  const usage = new Map<string, { count: number; last: string | null }>();
  for (const launch of launches) {
    const u = usage.get(launch.quote_mint) ?? { count: 0, last: null };
    u.count += 1;
    if (!u.last || Date.parse(launch.created_at) > Date.parse(u.last)) {
      u.last = launch.created_at;
    }
    usage.set(launch.quote_mint, u);
  }

  const quotes: StagingQuote[] = allowlist
    .map((q) => {
      const u = usage.get(q.mint);
      return {
        mint: q.mint,
        symbol: q.symbol,
        name: q.name,
        badge_verified_at: q.badge_verified_at,
        pool_count: u?.count ?? 0,
        last_launch_at: u?.last ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.pool_count - a.pool_count || a.symbol.localeCompare(b.symbol),
    );

  return {
    source: "file",
    generated_at: backfill.generated_at ?? null,
    launches,
    launchpads,
    quotes,
    allowlist_count,
  };
}

export function fileMeta(
  bundle: FileBundle,
  count: number,
): StagingListMeta {
  return {
    source: bundle.source,
    generated_at: bundle.generated_at,
    cutoff_iso: DBC_021_CUTOFF_ISO,
    allowlist_count: bundle.allowlist_count,
    count,
  };
}
