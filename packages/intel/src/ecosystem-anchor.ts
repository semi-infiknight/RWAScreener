import { WATCHED_BUILDER_HANDLES } from "./project-graph.js";

/** Text / handle anchors for “this is Meteora ecosystem,” including screener pads. */

export const SCREENER_PAD_HANDLES = new Set(
  [
    "embercurve",
    "embercurvefun",
    "lfowndotfun",
    "getstonkoptions",
    "launchonsf",
    "stardotfun",
    "bagsapp",
    "perpspadfun",
    "clawpumptech",
    "ethicslaunch",
    "revshare_app",
    "otc_labs",
  ].map((h) => h.toLowerCase()),
);

const ECOSYSTEM_TEXT_RE =
  /solana|\$sol|meteora|@meteoraag|@meteoraeco|@vesper792|vesper|dbc|damm|dlmm|invent|stocklana|chainrot|nouspad|stocklaunch|embercurve|ember curve|embercurvefun|lfown|letsfuckingown|bags\.fm|bagsapp|perpspad|clawpump|stonkoptions|star\.fun|launchonsf|ethics\.ltd|ethicslaunch|revshare|otcdesks|otc.?labs/;

export function hasEcosystemAnchor(text: string, username?: string): boolean {
  const handle = (username ?? "").toLowerCase().replace(/^@/, "");
  if (isTrackedProjectAccount(handle)) return true;
  if (handle === "vesper792" || handle === "meteoraag" || handle === "meteoraeco") return true;
  return ECOSYSTEM_TEXT_RE.test(text.toLowerCase());
}

export function isScreenerPadAccount(username?: string): boolean {
  const handle = (username ?? "").toLowerCase().replace(/^@/, "");
  return Boolean(handle) && SCREENER_PAD_HANDLES.has(handle);
}

export function isWatchedBuilderAccount(username?: string): boolean {
  const handle = (username ?? "").toLowerCase().replace(/^@/, "");
  return Boolean(handle) && WATCHED_BUILDER_HANDLES.includes(handle);
}

/** Screener pads + DBC/stock/hackathon builders we keep a timeline on. */
export function isTrackedProjectAccount(username?: string): boolean {
  return isScreenerPadAccount(username) || isWatchedBuilderAccount(username);
}

const DBC_FOCUS_RE =
  /\b(dbc|dynamic bonding curve|bonding curve|invent|fun launch|poolconfig|partner config|dynamic-bonding-curve)\b/;

const PAD_DRAMA_RE =
  /embercurve|ember curve|embercurvefun|lfown|letsfuckingown|bags\.fm|bagsapp|perpspad|clawpump|stonkoptions|star\.fun|launchonsf|getstonk|ethicslaunch|ethics\.ltd|revshare|otc.?labs/;

export function hasDbcFocus(text: string): boolean {
  return DBC_FOCUS_RE.test(text.toLowerCase());
}

/** Public ecosystem lane: tracked pads, DBC/Invent builders, or named pad drama. */
export function isDbcLanePost(
  text: string,
  username?: string,
  bucket?: string,
): boolean {
  if (isTrackedProjectAccount(username)) return true;
  if (hasDbcFocus(text)) return true;
  if (bucket === "pad_ecosystem_drama" && PAD_DRAMA_RE.test(text.toLowerCase())) {
    return true;
  }
  return false;
}

export function isLpArmyNoise(text: string): boolean {
  return /\blp\s*army\b|\blparmy\b|\$lparmy|met_lparmy/.test(text.toLowerCase());
}

/** Dex-screener / events.fun alert bots that mention Meteora/DLMM by template. */
export function isDexEventBotSpam(text: string, username?: string): boolean {
  const handle = (username ?? "").toLowerCase().replace(/^@/, "");
  if (
    handle.includes("dexevents") ||
    handle.includes("eventsdex") ||
    handle.startsWith("dex_event")
  ) {
    return true;
  }
  const t = text.toLowerCase();
  if (t.includes("dexevents.fun")) return true;
  if (/meteora_pair[_ ]/.test(t)) return true;
  if (t.includes("check events")) return true;
  if (/influencer post:\s*kol/i.test(text)) return true;
  return false;
}

const SOLANA_CA_RE = /\bca[:\s=]+[1-9a-hj-np-za-km-z]{32,44}\b/i;
const SOLANA_MINT_LINK_RE = /\bsolana:[1-9a-hj-np-za-km-z]{32,44}\b/i;
/** pump.fun mints always end in `pump`. */
const PUMPFUN_MINT_RE = /\b[1-9a-hj-np-za-km-z]{28,40}pump\b/i;
/** `$BLEND 140K` style mcap calls. */
const TICKER_MCAP_RE = /\$[a-z0-9]{2,15}\s+\d+(\.\d+)?[kmb]\b/i;

function hasBuilderPadTek(text: string): boolean {
  return /\b(dbc|damm|invent|bonding curve|poolconfig|partner config|launchpad)\b/.test(
    text.toLowerCase(),
  );
}

/**
 * Ticker calls, LP-yield farming, prize-pool name-drops — not pad/builder discourse.
 */
export function isRetailFeedSpam(text: string, username?: string): boolean {
  if (isLpArmyNoise(text) || isDexEventBotSpam(text, username)) return true;
  const t = text.toLowerCase();
  if (/ai signal/.test(t)) return true;
  if (SOLANA_CA_RE.test(text) || SOLANA_MINT_LINK_RE.test(text)) return true;
  if (PUMPFUN_MINT_RE.test(text)) return true;
  if (TICKER_MCAP_RE.test(text) && !hasBuilderPadTek(text)) return true;
  if (/trading contest/.test(t)) return true;
  if (/dlmm challenge/.test(t)) return true;
  if (/\blp bot\b/.test(t)) return true;
  if (/\bprize pool\b/.test(t) && !hasBuilderPadTek(text)) return true;
  if (/\$[a-z0-9]+\b/.test(t) && /\b(tvl|apr)\b/.test(t) && !hasBuilderPadTek(text)) {
    return true;
  }
  if (/\bfor lps\b/.test(t)) return true;
  if (/provide .{0,80}liquidity/.test(t) && !/\balpha vault\b/.test(t)) return true;
  return false;
}

/** Accounts whose posts + mentions make the ecosystem “Following” column. */
export const LIST_FEED_HANDLES = [
  ...new Set([
    "vesper792",
    "meteoraag",
    "meteoraeco",
    ...SCREENER_PAD_HANDLES,
    ...WATCHED_BUILDER_HANDLES,
  ]),
];

