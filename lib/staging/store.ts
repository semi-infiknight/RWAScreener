import { DBC_021_CUTOFF_ISO } from "./constants";
import {
  isAllowedQuoteMint,
  loadLaunchpadLabels,
  loadQuoteAllowlist,
  quoteAllowlistSet,
} from "./allowlist";
import { hasDatabaseUrl, withClient } from "./db";
import { fileMeta, loadFileBundle } from "./file-store";
import { normalizeStagingStatus } from "./status";
import { resolveQuoteCategory } from "./category";
import type {
  StagingLaunch,
  StagingLaunchpad,
  StagingListMeta,
  StagingQuote,
} from "./types";

export type LaunchesResult = {
  meta: StagingListMeta;
  launches: StagingLaunch[];
};

export type LaunchpadsResult = {
  meta: StagingListMeta;
  launchpads: StagingLaunchpad[];
};

export type QuotesResult = {
  meta: StagingListMeta;
  quotes: StagingQuote[];
};

function emptyMeta(count: number, source: StagingListMeta["source"] = "empty"): StagingListMeta {
  return {
    source,
    generated_at: null,
    cutoff_iso: DBC_021_CUTOFF_ISO,
    allowlist_count: loadQuoteAllowlist().length,
    count,
  };
}

async function launchesFromPg(limit: number): Promise<LaunchesResult | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const allow = [...quoteAllowlistSet()];
    if (allow.length === 0) {
      return { meta: emptyMeta(0, "postgres"), launches: [] };
    }
    const labels = loadLaunchpadLabels();
    const symbols = new Map(loadQuoteAllowlist().map((q) => [q.mint, q.symbol]));
    const rows = await withClient(async (client) => {
      const res = await client.query<{
        address: string;
        config: string;
        base_mint: string;
        quote_mint: string;
        creator: string | null;
        fee_claimer: string | null;
        activation_at: Date | null;
        created_at: Date;
        status: string;
        raw: { migration_progress?: number | null } | null;
      }>(
        `SELECT p.address, p.config, p.base_mint, p.quote_mint, p.creator,
                c.fee_claimer, p.activation_at, p.created_at, p.status, p.raw
         FROM pools p
         JOIN configs c ON c.address = p.config
         WHERE p.quote_mint = ANY($1::text[])
           AND p.created_at >= $2::timestamptz
         ORDER BY p.created_at DESC
         LIMIT $3`,
        [allow, DBC_021_CUTOFF_ISO, limit],
      );
      return res.rows;
    });
    if (rows === null) return null;
    const launches: StagingLaunch[] = rows
      .filter((r) => isAllowedQuoteMint(r.quote_mint))
      .map((r) => ({
        address: r.address,
        config: r.config,
        base_mint: r.base_mint,
        quote_mint: r.quote_mint,
        quote_symbol: symbols.get(r.quote_mint) ?? null,
        creator: r.creator,
        fee_claimer: r.fee_claimer,
        launchpad_label: r.fee_claimer
          ? labels[r.fee_claimer]?.label ?? null
          : null,
        activation_at: r.activation_at ? r.activation_at.toISOString() : null,
        created_at: r.created_at.toISOString(),
        status: normalizeStagingStatus(r.status, r.raw),
      }));
    return {
      meta: {
        source: "postgres",
        generated_at: new Date().toISOString(),
        cutoff_iso: DBC_021_CUTOFF_ISO,
        allowlist_count: allow.length,
        count: launches.length,
      },
      launches,
    };
  } catch (err) {
    console.warn("[staging] postgres launches failed; falling back to file", err);
    return null;
  }
}

async function launchpadsFromPg(): Promise<LaunchpadsResult | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const allow = [...quoteAllowlistSet()];
    if (allow.length === 0) {
      return { meta: emptyMeta(0, "postgres"), launchpads: [] };
    }
    const labels = loadLaunchpadLabels();
    const symbols = new Map(loadQuoteAllowlist().map((q) => [q.mint, q.symbol]));
    const rows = await withClient(async (client) => {
      const res = await client.query<{
        fee_claimer: string;
        pool_count: string;
        config_count: string;
        quote_mint_count: string;
        first_seen_at: Date | null;
        last_seen_at: Date | null;
        sample_quote_mints: string[] | null;
      }>(
        `SELECT COALESCE(c.fee_claimer, 'unknown') AS fee_claimer,
                COUNT(p.address)::text AS pool_count,
                COUNT(DISTINCT p.config)::text AS config_count,
                COUNT(DISTINCT p.quote_mint)::text AS quote_mint_count,
                MIN(p.created_at) AS first_seen_at,
                MAX(p.created_at) AS last_seen_at,
                (ARRAY_AGG(DISTINCT p.quote_mint))[1:8] AS sample_quote_mints
         FROM pools p
         JOIN configs c ON c.address = p.config
         WHERE p.quote_mint = ANY($1::text[])
           AND p.created_at >= $2::timestamptz
         GROUP BY COALESCE(c.fee_claimer, 'unknown')
         ORDER BY COUNT(p.address) DESC, MAX(p.created_at) DESC NULLS LAST`,
        [allow, DBC_021_CUTOFF_ISO],
      );
      return res.rows;
    });
    if (rows === null) return null;
    const launchpads: StagingLaunchpad[] = rows.map((r) => {
      const fee = r.fee_claimer;
      const sample = (r.sample_quote_mints ?? [])
        .map((m) => symbols.get(m))
        .filter((s): s is string => Boolean(s))
        .slice(0, 8);
      return {
        fee_claimer: fee,
        label: fee !== "unknown" ? labels[fee]?.label ?? null : null,
        website: fee !== "unknown" ? labels[fee]?.website ?? null : null,
        pool_count: Number(r.pool_count) || 0,
        config_count: Number(r.config_count) || 0,
        quote_mint_count: Number(r.quote_mint_count) || 0,
        first_seen_at: r.first_seen_at ? r.first_seen_at.toISOString() : null,
        last_seen_at: r.last_seen_at ? r.last_seen_at.toISOString() : null,
        sample_quote_symbols: sample,
      };
    });
    return {
      meta: {
        source: "postgres",
        generated_at: new Date().toISOString(),
        cutoff_iso: DBC_021_CUTOFF_ISO,
        allowlist_count: allow.length,
        count: launchpads.length,
      },
      launchpads,
    };
  } catch (err) {
    console.warn("[staging] postgres launchpads failed; falling back to file", err);
    return null;
  }
}

async function quotesFromPg(): Promise<QuotesResult | null> {
  if (!hasDatabaseUrl()) return null;
  try {
    const allowlist = loadQuoteAllowlist();
    if (allowlist.length === 0) {
      return { meta: emptyMeta(0, "postgres"), quotes: [] };
    }
    const allow = allowlist.map((q) => q.mint);
    const rows = await withClient(async (client) => {
      const res = await client.query<{
        quote_mint: string;
        pool_count: string;
        last_launch_at: Date | null;
      }>(
        `SELECT p.quote_mint,
                COUNT(*)::text AS pool_count,
                MAX(p.created_at) AS last_launch_at
         FROM pools p
         WHERE p.quote_mint = ANY($1::text[])
           AND p.created_at >= $2::timestamptz
         GROUP BY p.quote_mint`,
        [allow, DBC_021_CUTOFF_ISO],
      );
      return res.rows;
    });
    if (rows === null) return null;
    const usage = new Map(
      rows.map((r) => [
        r.quote_mint,
        {
          count: Number(r.pool_count) || 0,
          last: r.last_launch_at ? r.last_launch_at.toISOString() : null,
        },
      ]),
    );
    const quotes: StagingQuote[] = allowlist
      .map((q) => {
        const u = usage.get(q.mint);
        return {
          mint: q.mint,
          symbol: q.symbol,
          name: q.name,
          logo: q.logo ?? null,
          badge_verified_at: q.badge_verified_at,
          category: resolveQuoteCategory(q),
          pool_count: u?.count ?? 0,
          last_launch_at: u?.last ?? null,
        };
      })
      .sort(
        (a, b) =>
          b.pool_count - a.pool_count || a.symbol.localeCompare(b.symbol),
      );
    return {
      meta: {
        source: "postgres",
        generated_at: new Date().toISOString(),
        cutoff_iso: DBC_021_CUTOFF_ISO,
        allowlist_count: allowlist.length,
        count: quotes.length,
      },
      quotes,
    };
  } catch (err) {
    console.warn("[staging] postgres quotes failed; falling back to file", err);
    return null;
  }
}

export async function getLaunches(opts?: {
  limit?: number;
  quote_mint?: string | null;
  fee_claimer?: string | null;
}): Promise<LaunchesResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000);
  const fromPg = await launchesFromPg(limit * 2);
  let result: LaunchesResult;
  if (fromPg) {
    result = fromPg;
  } else {
    const bundle = loadFileBundle();
    result = {
      meta: fileMeta(bundle, bundle.launches.length),
      launches: bundle.launches,
    };
  }
  let launches = result.launches;
  if (opts?.quote_mint) {
    launches = launches.filter((l) => l.quote_mint === opts.quote_mint);
  }
  if (opts?.fee_claimer) {
    launches = launches.filter((l) => l.fee_claimer === opts.fee_claimer);
  }
  launches = launches.slice(0, limit);
  return {
    meta: { ...result.meta, count: launches.length },
    launches,
  };
}

export async function getLaunchpads(): Promise<LaunchpadsResult> {
  const fromPg = await launchpadsFromPg();
  if (fromPg) return fromPg;
  const bundle = loadFileBundle();
  return {
    meta: fileMeta(bundle, bundle.launchpads.length),
    launchpads: bundle.launchpads,
  };
}

export async function getQuotes(): Promise<QuotesResult> {
  const fromPg = await quotesFromPg();
  if (fromPg) return fromPg;
  const bundle = loadFileBundle();
  return {
    meta: fileMeta(bundle, bundle.quotes.length),
    quotes: bundle.quotes,
  };
}
