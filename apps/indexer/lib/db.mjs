import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../../..");
export const MIGRATION_PATH = path.join(
  ROOT,
  "packages",
  "db",
  "migrations",
  "001_init.sql",
);

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function createPool() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  return new pg.Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
}

/** Apply packages/db/migrations/001_init.sql (idempotent IF NOT EXISTS). */
export async function migrate(pool) {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  await pool.query(sql);
  return { ok: true, path: MIGRATION_PATH };
}
