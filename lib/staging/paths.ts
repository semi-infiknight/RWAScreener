import path from "node:path";

/** Resolve data / migration paths from the Next.js app root (process.cwd()). */
export function dataPath(...parts: string[]): string {
  return path.join(process.cwd(), "data", ...parts);
}

export function migrationPath(name = "001_init.sql"): string {
  return path.join(process.cwd(), "packages", "db", "migrations", name);
}
