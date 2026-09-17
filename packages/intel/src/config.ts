import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = resolve(__dirname, "..");
/** RWAScreener repo root (packages/intel → ../..) */
export const REPO_ROOT = resolve(PKG_ROOT, "../..");

function loadEnvFiles() {
  const candidates = [
    join(PKG_ROOT, ".env"),
    join(REPO_ROOT, ".env"),
    join(PKG_ROOT, ".env.local"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

loadEnvFiles();

/** Override with METEORA_INTEL_DATA_DIR for isolated tests / scratch runs. */
export function getDataDir(): string {
  const override = process.env.METEORA_INTEL_DATA_DIR?.trim();
  return override && override.length > 0 ? override : join(PKG_ROOT, "data");
}

export function getMentionsPath(): string {
  return join(getDataDir(), "mentions.jsonl");
}

export function getRunsPath(): string {
  return join(getDataDir(), "runs.jsonl");
}

/** @deprecated prefer getDataDir() — kept for callers that need a snapshot */
export const DATA_DIR = getDataDir();
export const MENTIONS_PATH = getMentionsPath();
export const RUNS_PATH = getRunsPath();

export function requireBearerToken(): string {
  const token =
    process.env.X_BEARER_TOKEN?.trim() ||
    process.env.TWITTER_BEARER_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Missing X_BEARER_TOKEN. Set it in RWAScreener/.env or packages/intel/.env",
    );
  }
  return token;
}

export const X_API_BASE = "https://api.x.com/2";

/** Default posts per query (10–100 for recent search) */
export const DEFAULT_MAX_RESULTS = 25;
