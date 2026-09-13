import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./db.mjs";

const BLOCKED = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);


/** Fail-closed: graduated only when raw.migration_progress === 3 (CreatedPool). */
function normalizePoolStatus(p) {
  const prog = p?.raw?.migration_progress;
  if (typeof prog === "number") {
    return prog === 3 ? "graduated" : "curve";
  }
  if (p?.status === "graduated") return "graduated";
  return "curve";
}

function loadQuoteSeed(seedPath) {
  const file = seedPath || path.join(ROOT, "data", "quote-mints.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = Array.isArray(raw.quote_mints) ? raw.quote_mints : [];
  return rows.filter(
    (r) => typeof r?.mint === "string" && r.mint && !BLOCKED.has(r.mint),
  );
}

function loadLabels() {
  const out = {};
  for (const name of ["launchpad-labels.json", "fee-claimer-attribution.json"]) {
    const file = path.join(ROOT, "data", name);
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const map = raw.fee_claimer_labels || raw.proven_labels || {};
      for (const [k, v] of Object.entries(map)) {
        if (!v?.label) continue;
        if (!out[k]) {
          out[k] = {
            label: v.label,
            website: v.website ?? null,
            notes: typeof v.evidence === "string" ? v.evidence : v.notes ?? null,
          };
        }
      }
    } catch {
      /* optional */
    }
  }
  return out;
}

/**
 * Upsert quote_mints, configs, pools, launchpad_labels from a backfillOnce result
 * (or data/dbc-backfill-result.json shape). Idempotent. Never invents rows.
 */
export async function ingestBackfillResult(pool, result, opts = {}) {
  const seed = loadQuoteSeed(opts.seedPath);
  const allow = new Set(seed.map((r) => r.mint));
  const labels = { ...loadLabels(), ...(result.fee_claimer_labels || {}) };

  const configs = Array.isArray(result.configs) ? result.configs : [];
  const pools = Array.isArray(result.pools) ? result.pools : [];

  const client = await pool.connect();
  const stats = {
    quote_mints: 0,
    configs: 0,
    pools: 0,
    labels: 0,
    skipped_bad_quote: 0,
    skipped_no_created_at: 0,
  };

  try {
    await client.query("BEGIN");

    for (const q of seed) {
      await client.query(
        `INSERT INTO quote_mints (mint, symbol, name, badge_verified_at, meta)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (mint) DO UPDATE SET
           symbol = EXCLUDED.symbol,
           name = COALESCE(EXCLUDED.name, quote_mints.name),
           badge_verified_at = COALESCE(EXCLUDED.badge_verified_at, quote_mints.badge_verified_at),
           meta = COALESCE(EXCLUDED.meta, quote_mints.meta)`,
        [
          q.mint,
          q.symbol || "",
          q.name || null,
          q.badge_verified_at || null,
          JSON.stringify(q.meta && typeof q.meta === "object" ? q.meta : {}),
        ],
      );
      stats.quote_mints += 1;
    }

    // Ensure any quote on configs/pools that is allowlisted exists (FK).
    const neededQuotes = new Set();
    for (const c of configs) {
      if (c?.quote_mint && allow.has(c.quote_mint)) neededQuotes.add(c.quote_mint);
    }
    for (const p of pools) {
      if (p?.quote_mint && allow.has(p.quote_mint)) neededQuotes.add(p.quote_mint);
    }
    for (const mint of neededQuotes) {
      if (seed.some((s) => s.mint === mint)) continue;
      await client.query(
        `INSERT INTO quote_mints (mint, symbol, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (mint) DO NOTHING`,
        [mint, mint.slice(0, 6), null],
      );
    }

    for (const c of configs) {
      if (!c?.address || !c?.quote_mint) continue;
      if (!allow.has(c.quote_mint) || BLOCKED.has(c.quote_mint)) {
        stats.skipped_bad_quote += 1;
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
           updated_at = now()`,
        [
          c.address,
          c.quote_mint,
          c.fee_claimer ?? null,
          JSON.stringify(c.raw ?? {}),
          firstSeen,
        ],
      );
      stats.configs += 1;
    }

    for (const p of pools) {
      if (!p?.address || !p?.config || !p?.base_mint || !p?.quote_mint) continue;
      if (!allow.has(p.quote_mint) || BLOCKED.has(p.quote_mint)) {
        stats.skipped_bad_quote += 1;
        continue;
      }
      if (!p.created_at) {
        stats.skipped_no_created_at += 1;
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
          normalizePoolStatus(p),
          JSON.stringify(p.raw ?? {}),
        ],
      );
      stats.pools += 1;
    }

    for (const [fee, v] of Object.entries(labels)) {
      if (!fee || !v?.label) continue;
      await client.query(
        `INSERT INTO launchpad_labels (fee_claimer, label, website, notes, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (fee_claimer) DO UPDATE SET
           label = EXCLUDED.label,
           website = COALESCE(EXCLUDED.website, launchpad_labels.website),
           notes = COALESCE(EXCLUDED.notes, launchpad_labels.notes),
           updated_at = now()`,
        [fee, v.label, v.website ?? null, v.notes ?? null],
      );
      stats.labels += 1;
    }

    await client.query(
      `INSERT INTO ingest_cursor (name, value, updated_at)
       VALUES ('dbc_backfill_last', $1, now())
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [
        JSON.stringify({
          at: new Date().toISOString(),
          poolCount: stats.pools,
          configCount: stats.configs,
          reason: result.reason || null,
        }),
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return stats;
}

export function loadArtifact(artifactPath) {
  const file =
    artifactPath || path.join(ROOT, "data", "dbc-backfill-result.json");
  if (!fs.existsSync(file)) {
    return { ok: false, reason: `artifact missing: ${file}`, file };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ok: true, file, result: raw };
}
