/**
 * Optional Postgres upsert for DBC backfill (SPEC §5.2 / §6).
 * Skips cleanly when DATABASE_URL is unset. Never invents fee_claimer labels.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadQuoteMints } from "./quote-mints.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(__dirname, "../db/migrations/001_init.sql");

/** Noise quotes never allowed as stock-quote SoT. */
const BLOCKED = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

function databaseUrl() {
  return (process.env.DATABASE_URL || "").trim();
}

/**
 * Idempotent upsert of quote_mints → configs → pools from a backfillOnce result.
 * Does not write launchpad_labels (no invented fee_claimer labels).
 *
 * @returns {{ skipped: true, reason: string } | { skipped: false, quoteMints: number, configs: number, pools: number, skippedBadQuote: number, skippedNoCreatedAt: number }}
 */
export async function upsertBackfillResult(result, opts = {}) {
  const url = opts.databaseUrl ?? databaseUrl();
  if (!url) {
    return { skipped: true, reason: "DATABASE_URL unset — skipping DB upsert" };
  }

  const pg = await import("pg");
  const Pool = pg.Pool || pg.default?.Pool;
  if (!Pool) throw new Error("pg.Pool unavailable — install dependency `pg`");
  const pool = new Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });

  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(MIGRATION, "utf8");
    await client.query(sql);

    const allowlist = loadQuoteMints(opts.seedPath).filter(
      (r) => r.mint && !BLOCKED.has(r.mint),
    );
    const allow = new Set(allowlist.map((r) => r.mint));
    const configs = Array.isArray(result?.configs) ? result.configs : [];
    const pools = Array.isArray(result?.pools) ? result.pools : [];

    let quoteMintCount = 0;
    let configCount = 0;
    let poolCount = 0;
    let skippedBadQuote = 0;
    let skippedNoCreatedAt = 0;

    await client.query("BEGIN");

    for (const row of allowlist) {
      await client.query(
        `INSERT INTO quote_mints (mint, symbol, name, badge_verified_at, meta)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (mint) DO UPDATE SET
           symbol = EXCLUDED.symbol,
           name = COALESCE(EXCLUDED.name, quote_mints.name),
           badge_verified_at = COALESCE(EXCLUDED.badge_verified_at, quote_mints.badge_verified_at),
           meta = COALESCE(EXCLUDED.meta, quote_mints.meta)`,
        [
          row.mint,
          row.symbol || "",
          row.name || null,
          row.badge_verified_at || null,
          JSON.stringify(row.meta || {}),
        ],
      );
      quoteMintCount += 1;
    }

    for (const c of configs) {
      if (!c?.address || !c?.quote_mint) continue;
      if (!allow.has(c.quote_mint) || BLOCKED.has(c.quote_mint)) {
        skippedBadQuote += 1;
        continue;
      }
      const firstSeen = c.first_seen_at || new Date().toISOString();
      await client.query(
        `INSERT INTO configs (address, quote_mint, fee_claimer, raw, first_seen_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, now())
         ON CONFLICT (address) DO UPDATE SET
           quote_mint = EXCLUDED.quote_mint,
           fee_claimer = COALESCE(EXCLUDED.fee_claimer, configs.fee_claimer),
           raw = COALESCE(EXCLUDED.raw, configs.raw),
           first_seen_at = LEAST(configs.first_seen_at, EXCLUDED.first_seen_at),
           updated_at = now()`,
        [
          c.address,
          c.quote_mint,
          c.fee_claimer ?? null,
          JSON.stringify(c.raw ?? {}),
          firstSeen,
        ],
      );
      configCount += 1;
    }

    for (const p of pools) {
      if (!p?.address || !p?.config || !p?.base_mint || !p?.quote_mint) continue;
      if (!allow.has(p.quote_mint) || BLOCKED.has(p.quote_mint)) {
        skippedBadQuote += 1;
        continue;
      }
      if (!p.created_at) {
        skippedNoCreatedAt += 1;
        continue;
      }
      await client.query(
        `INSERT INTO pools (
           address, config, base_mint, quote_mint, creator,
           activation_at, created_at, status, raw, indexed_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6::timestamptz, $7::timestamptz, $8, $9::jsonb, now()
         )
         ON CONFLICT (address) DO UPDATE SET
           config = EXCLUDED.config,
           base_mint = EXCLUDED.base_mint,
           quote_mint = EXCLUDED.quote_mint,
           creator = COALESCE(EXCLUDED.creator, pools.creator),
           activation_at = COALESCE(EXCLUDED.activation_at, pools.activation_at),
           created_at = EXCLUDED.created_at,
           status = COALESCE(EXCLUDED.status, pools.status),
           raw = COALESCE(EXCLUDED.raw, pools.raw),
           indexed_at = now()`,
        [
          p.address,
          p.config,
          p.base_mint,
          p.quote_mint,
          p.creator ?? null,
          p.activation_at ?? null,
          p.created_at,
          p.status || "curve",
          JSON.stringify(p.raw ?? {}),
        ],
      );
      poolCount += 1;
    }

    // Cursor only — never invent launchpad_labels.
    await client.query(
      `INSERT INTO ingest_cursor (name, value, updated_at)
       VALUES ('dbc_backfill_last', $1, now())
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [
        JSON.stringify({
          at: new Date().toISOString(),
          poolCount,
          configCount,
          reason: result?.reason || null,
        }),
      ],
    );

    await client.query("COMMIT");
    return {
      skipped: false,
      quoteMints: quoteMintCount,
      configs: configCount,
      pools: poolCount,
      skippedBadQuote,
      skippedNoCreatedAt,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
