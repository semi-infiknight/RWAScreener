/**
 * Pure allowlist parse — no fetch / cache.
 * Fail closed: unknown pads and unverified mint strings are dropped.
 */
export type PlatformTokenSeed = {
  launchpadId: string;
  symbol: string;
  mint: string;
  website?: string;
  note?: string;
};

export type PlatformTokenRow = {
  launchpadId: string;
  symbol: string;
  mint: string;
  mcapUsd: number | null;
};

export type PlatformTokenMap = Record<string, PlatformTokenRow>;

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type SeedFile = {
  tokens?: unknown;
};

export function isSolanaMint(value: string): boolean {
  return SOLANA_MINT_RE.test(value);
}

export function parsePlatformTokenSeed(
  raw: unknown,
  knownPadIds: ReadonlySet<string>,
): PlatformTokenSeed[] {
  if (!raw || typeof raw !== "object") return [];
  const tokens = (raw as SeedFile).tokens;
  if (!Array.isArray(tokens)) return [];

  const seenPads = new Set<string>();
  const seenMints = new Set<string>();
  const out: PlatformTokenSeed[] = [];

  for (const row of tokens) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const launchpadId =
      typeof rec.launchpadId === "string" ? rec.launchpadId.trim() : "";
    const symbol = typeof rec.symbol === "string" ? rec.symbol.trim() : "";
    const mint = typeof rec.mint === "string" ? rec.mint.trim() : "";
    if (!launchpadId || !knownPadIds.has(launchpadId)) continue;
    if (!symbol || !isSolanaMint(mint)) continue;
    if (seenPads.has(launchpadId) || seenMints.has(mint)) continue;
    seenPads.add(launchpadId);
    seenMints.add(mint);
    const website =
      typeof rec.website === "string" ? rec.website.trim() : undefined;
    const note = typeof rec.note === "string" ? rec.note.trim() : undefined;
    out.push({
      launchpadId,
      symbol,
      mint,
      ...(website ? { website } : {}),
      ...(note ? { note } : {}),
    });
  }
  return out;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

export function mcapFromJupiterToken(body: unknown, mint: string): number | null {
  if (!Array.isArray(body)) return null;
  const hit = body.find(
    (row) =>
      row &&
      typeof row === "object" &&
      (row as { id?: unknown }).id === mint,
  );
  if (!hit || typeof hit !== "object") return null;
  return numOrNull((hit as { mcap?: unknown }).mcap);
}
