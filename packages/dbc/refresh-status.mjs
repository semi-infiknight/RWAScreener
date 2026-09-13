/**
 * One-shot: re-read VirtualPool accounts and UPDATE pools.status in Postgres.
 * Graduated = migration_progress CreatedPool(3) only. Fail closed → curve.
 * Never prints secrets. Requires HELIUS_API_KEY + DATABASE_URL.
 */
import { heliusRpc, mapPool } from "./helius.mjs";
import { poolStatusFromAccountData } from "./status.mjs";
import { loadDotEnv } from "./env.mjs";

/**
 * @param {{ databaseUrl?: string, heliusApiKey?: string, addresses?: string[], concurrency?: number }} opts
 */
export async function refreshPoolStatuses(opts = {}) {
  loadDotEnv();
  const heliusApiKey = (opts.heliusApiKey ?? process.env.HELIUS_API_KEY ?? "").trim();
  const databaseUrl = (opts.databaseUrl ?? process.env.DATABASE_URL ?? "").trim();
  if (!heliusApiKey) {
    return { ok: false, reason: "HELIUS_API_KEY missing — fail closed" };
  }
  if (!databaseUrl) {
    return { ok: false, reason: "DATABASE_URL missing — cannot refresh" };
  }

  const pg = await import("pg");
  const Pool = pg.Pool || pg.default?.Pool;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });

  const client = await pool.connect();
  try {
    let addresses = opts.addresses;
    if (!addresses?.length) {
      const { rows } = await client.query("SELECT address FROM pools");
      addresses = rows.map((r) => r.address);
    }

    let graduated = 0;
    let curve = 0;
    let missing = 0;
    const concurrency = opts.concurrency ?? 4;

    // Batch getMultipleAccounts (100)
    const updates = [];
    for (let i = 0; i < addresses.length; i += 100) {
      const chunk = addresses.slice(i, i + 100);
      const accounts = await heliusRpc(heliusApiKey, "getMultipleAccounts", [
        chunk,
        { encoding: "base64" },
      ]);
      const values = accounts?.value || [];
      for (let j = 0; j < chunk.length; j++) {
        const acc = values[j];
        if (!acc?.data?.[0]) {
          missing += 1;
          updates.push({ address: chunk[j], status: "curve", migration_progress: null, is_migrated: null });
          curve += 1;
          continue;
        }
        const data = Buffer.from(acc.data[0], "base64");
        const mig = poolStatusFromAccountData(data);
        if (mig.status === "graduated") graduated += 1;
        else curve += 1;
        updates.push({
          address: chunk[j],
          status: mig.status,
          migration_progress: mig.migration_progress,
          is_migrated: mig.is_migrated,
        });
      }
    }

    await client.query("BEGIN");
    for (const u of updates) {
      await client.query(
        `UPDATE pools
         SET status = $2,
             raw = COALESCE(raw, '{}'::jsonb) || $3::jsonb,
             indexed_at = now()
         WHERE address = $1`,
        [
          u.address,
          u.status,
          JSON.stringify({
            migration_progress: u.migration_progress,
            is_migrated: u.is_migrated,
            status_source: "virtual_pool_migration_progress",
          }),
        ],
      );
    }
    await client.query("COMMIT");

    const { rows: counts } = await client.query(
      `SELECT status, count(*)::int AS n FROM pools GROUP BY status ORDER BY status`,
    );

    return {
      ok: true,
      scanned: addresses.length,
      graduated,
      curve,
      missing,
      dbCounts: Object.fromEntries(counts.map((r) => [r.status, r.n])),
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
