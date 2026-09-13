import fs from "node:fs";
import type { Pool, PoolClient } from "pg";
import { migrationPath } from "./paths";

let pool: Pool | null = null;
let migrated = false;
let migratePromise: Promise<void> | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getPool(): Promise<Pool | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (pool) return pool;
  const { Pool: PgPool } = await import("pg");
  pool = new PgPool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

/** Apply packages/db/migrations/001_init.sql once per process (idempotent). */
export async function ensureMigrated(): Promise<boolean> {
  const p = await getPool();
  if (!p) return false;
  if (migrated) return true;
  if (!migratePromise) {
    migratePromise = (async () => {
      const sqlPath = migrationPath("001_init.sql");
      const sql = fs.readFileSync(sqlPath, "utf8");
      const client = await p.connect();
      try {
        await client.query(sql);
        migrated = true;
      } finally {
        client.release();
      }
    })().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  await migratePromise;
  return true;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T | null> {
  const p = await getPool();
  if (!p) return null;
  await ensureMigrated();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
