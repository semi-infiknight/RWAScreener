import type { TokenRow } from "./tokens";

export type PurpsLaunch = {
  curvePct?: number | null;
  migrated?: boolean | null;
};

export type PurpsCoin = {
  mintAddress?: string;
  name?: string | null;
  symbol?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  origin?: string | null;
  chain?: string | null;
  mcap?: number | null;
  holders?: number | null;
  launch?: PurpsLaunch | null;
};

export function isPurpsMeteoraDbc(coin: PurpsCoin | null | undefined): boolean {
  if (!coin) return false;
  const chain = String(coin.chain || "").trim().toLowerCase();
  if (chain && chain !== "solana") return false;
  const origin = String(coin.origin || "").trim().toLowerCase();
  // Native pad launches + flagship PURPS. Drop pump / pons / robinhood.
  return origin === "launchpad" || origin === "meteora";
}

/** launch.migrated is the only SoT graduation flag in the public coins payload. */
export function mapPurpsStatus(coin: PurpsCoin): TokenRow["status"] {
  return coin.launch?.migrated === true ? "graduated" : "bonding";
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function positiveOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n == null || n === 0) return null;
  return n;
}

function ageHoursFromIso(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const hours = (Date.now() - ms) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.max(0, hours);
}

export function mapPurpsCoin(c: PurpsCoin): TokenRow | null {
  const mint = typeof c.mintAddress === "string" ? c.mintAddress.trim() : "";
  if (!mint) return null;
  const mcap = positiveOrNull(c.mcap);
  const holders = numOrNull(c.holders);
  return {
    id: `purps-${mint}`,
    launchpadId: "purps",
    symbol: String(c.symbol || "").trim() || mint.slice(0, 6),
    name:
      String(c.name || "").trim() ||
      String(c.symbol || "").trim() ||
      mint.slice(0, 8),
    mint,
    icon:
      typeof c.imageUrl === "string" && c.imageUrl.trim()
        ? c.imageUrl.trim()
        : null,
    status: mapPurpsStatus(c),
    priceUsd: null,
    change24hPct: null,
    mcapUsd: mcap,
    fdvUsd: mcap,
    volume24hUsd: null,
    liquidityUsd: null,
    holders,
    holdersDelta24h: null,
    ageHours: ageHoursFromIso(c.createdAt),
    rangeLowUsd: null,
    rangeHighUsd: null,
    rangePos: null,
    spark24h: null,
    draft: false,
  };
}
