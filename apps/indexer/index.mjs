#!/usr/bin/env node
/**
 * apps/indexer — DBC worker (SPEC §5.2 / §5.3 / §8)
 *
 * Commands:
 *   migrate              Apply packages/db/migrations/001_init.sql
 *   backfill             Run packages/dbc backfillOnce (fail closed w/o HELIUS_API_KEY);
 *                        if DATABASE_URL set, upsert into Postgres
 *   ingest [artifact]    Upsert existing backfill JSON into Postgres (requires DATABASE_URL)
 *   serve                HTTP webhook stub on PORT (default 8080)
 *   (default)            migrate (if DB) + backfill (+ ingest when DB)
 *
 * Never invents pools. Never prints secrets.
 */
import { backfillOnce, loadDotEnv } from "../../packages/dbc/index.mjs";
import { createPool, hasDatabaseUrl, migrate, ROOT } from "./lib/db.mjs";
import { ingestBackfillResult, loadArtifact } from "./lib/ingest.mjs";
import { startWebhookServer } from "./lib/webhook-server.mjs";

loadDotEnv(ROOT);

const args = process.argv.slice(2);
const cmd = args[0] || "default";

function usage() {
  console.log(`Usage: node apps/indexer/index.mjs <migrate|backfill|ingest|serve|default>

  migrate              Apply SQL schema (needs DATABASE_URL)
  backfill             Helius backfillOnce; upsert if DATABASE_URL set
  ingest [path]        Load artifact JSON → Postgres (default data/dbc-backfill-result.json)
  serve                Webhook stub POST /api/webhooks/helius
  default              migrate (if DB) + backfill (+ ingest)
`);
}

async function cmdMigrate() {
  if (!hasDatabaseUrl()) {
    console.log(
      JSON.stringify({
        ok: false,
        skipped: true,
        reason: "DATABASE_URL missing — cannot migrate",
      }),
    );
    process.exit(1);
  }
  const pool = createPool();
  try {
    const result = await migrate(pool);
    console.log(JSON.stringify({ ok: true, migrated: true, ...result }));
  } finally {
    await pool.end();
  }
}

async function cmdBackfill({ doIngest }) {
  const result = await backfillOnce();
  const summary = {
    ok: result.ok,
    skipped: result.skipped || false,
    reason: result.reason,
    poolCount: result.pools?.length ?? 0,
    configCount: result.configs?.length ?? 0,
    stats: result.stats,
    artifactPath: result.artifactPath,
  };

  if (!result.ok) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  if (result.skipped) {
    // Fail closed without HELIUS_API_KEY — exit 0 so deploy health doesn't crash-loop,
    // but surface skipped clearly. Use BACKFILL_STRICT=1 to exit 1.
    console.log(JSON.stringify(summary, null, 2));
    process.exit(process.env.BACKFILL_STRICT === "1" ? 1 : 0);
  }

  if (doIngest && hasDatabaseUrl()) {
    const pool = createPool();
    try {
      await migrate(pool);
      const ingestStats = await ingestBackfillResult(pool, result);
      summary.ingested = true;
      summary.ingestStats = ingestStats;
    } finally {
      await pool.end();
    }
  } else if (doIngest) {
    summary.ingested = false;
    summary.ingestSkipped = "DATABASE_URL missing — wrote artifact only";
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

async function cmdIngest(artifactPath) {
  if (!hasDatabaseUrl()) {
    console.log(
      JSON.stringify({
        ok: false,
        skipped: true,
        reason: "DATABASE_URL missing — cannot ingest",
      }),
    );
    process.exit(1);
  }
  const loaded = loadArtifact(artifactPath);
  if (!loaded.ok) {
    console.log(JSON.stringify(loaded));
    process.exit(1);
  }
  const pool = createPool();
  try {
    await migrate(pool);
    const ingestStats = await ingestBackfillResult(pool, loaded.result);
    console.log(
      JSON.stringify({
        ok: true,
        artifact: loaded.file,
        ingestStats,
      }, null, 2),
    );
  } finally {
    await pool.end();
  }
}

async function cmdServe() {
  let pool = null;
  if (hasDatabaseUrl()) {
    pool = createPool();
    try {
      await migrate(pool);
    } catch (err) {
      console.warn("[indexer] migrate on serve failed", err?.message || err);
    }
  }
  startWebhookServer({ pool });
}

async function cmdDefault() {
  if (hasDatabaseUrl()) {
    const pool = createPool();
    try {
      await migrate(pool);
      console.log(JSON.stringify({ ok: true, migrated: true }));
    } finally {
      await pool.end();
    }
  }
  await cmdBackfill({ doIngest: true });
}

if (cmd === "-h" || cmd === "--help" || cmd === "help") {
  usage();
  process.exit(0);
}

try {
  if (cmd === "migrate") await cmdMigrate();
  else if (cmd === "backfill") await cmdBackfill({ doIngest: true });
  else if (cmd === "ingest") await cmdIngest(args[1]);
  else if (cmd === "serve") await cmdServe();
  else if (cmd === "default") await cmdDefault();
  else {
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      ok: false,
      error: String(err?.message || err),
    }),
  );
  process.exit(1);
}
