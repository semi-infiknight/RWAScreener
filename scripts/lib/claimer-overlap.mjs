/**
 * Pure pad-catalog × staging-pool overlap.
 * A hit requires pool address equality and/or mint+config (Ember/Ethics/OTC bar).
 * Mint-only is not attribution.
 */

function pk(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * @param {{ mint?: string|null, config?: string|null, pool?: string|null }} pad
 * @param {{ address: string, config: string, base_mint: string, quote_mint: string }} pool
 * @returns {"pool"|"config+mint"|null}
 */
export function padRowMatchesPool(pad, pool) {
  const poolAddr = pk(pad?.pool);
  const config = pk(pad?.config);
  const mint = pk(pad?.mint);
  if (poolAddr && poolAddr === pool.address) return "pool";
  if (
    config &&
    mint &&
    config === pool.config &&
    (mint === pool.base_mint || mint === pool.quote_mint)
  ) {
    return "config+mint";
  }
  return null;
}

/**
 * @param {Array<{ mint?: string|null, config?: string|null, pool?: string|null }>} padRows
 * @param {Array<{ address: string, config: string, base_mint: string, quote_mint: string, fee_claimer: string }>} pools
 * @returns {Map<string, { matchCount: number, hows: Record<string, number> }>}
 */
export function overlapByClaimer(padRows, pools) {
  const out = new Map();
  for (const pad of padRows) {
    for (const pool of pools) {
      const how = padRowMatchesPool(pad, pool);
      if (!how) continue;
      const fc = pk(pool.fee_claimer);
      if (!fc) continue;
      let rec = out.get(fc);
      if (!rec) {
        rec = { matchCount: 0, hows: {} };
        out.set(fc, rec);
      }
      rec.matchCount += 1;
      rec.hows[how] = (rec.hows[how] || 0) + 1;
    }
  }
  return out;
}

/**
 * Propose new labels. Never overwrites an existing claimer. Zero overlap → no write.
 *
 * @param {Record<string, { label?: string }>} existingLabels
 * @param {Map<string, { matchCount: number, hows: Record<string, number> }>} overlap
 * @param {{ label: string, launchpadId: string, website: string, x?: string, evidence: string }} padInfo
 */
export function buildLabelPatch(existingLabels, overlap, padInfo) {
  const patch = {};
  if (!padInfo?.label || !padInfo?.website || !padInfo?.evidence) return patch;
  for (const [fc, rec] of overlap.entries()) {
    if (!rec || rec.matchCount < 1) continue;
    if (existingLabels[fc]?.label) continue;
    patch[fc] = {
      label: padInfo.label,
      launchpadId: padInfo.launchpadId,
      website: padInfo.website,
      ...(padInfo.x ? { x: padInfo.x } : {}),
      evidence: padInfo.evidence.replaceAll("{n}", String(rec.matchCount)),
    };
  }
  return patch;
}

export const FORBIDDEN_INVENTED_IDS = [
  "bags",
  "perpspad",
  "clawpump",
  "lfgown",
  "stardotfun",
  "stonkoptions",
];

function slugFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

/**
 * Propose labels from complete PartnerMetadata. Never overwrites an existing
 * claimer. Mint-only invention of Bags/Perpspad/… ids is still forbidden —
 * PartnerMetadata with name+website is on-chain proof (allowed).
 *
 * @param {Record<string, { label?: string }>} existingLabels
 * @param {Array<{ fee_claimer: string, pda?: string, name: string, website: string, logo?: string|null }>} rows
 */
export function buildPartnerMetadataPatch(existingLabels, rows) {
  const patch = {};
  for (const row of rows || []) {
    const fc = pk(row?.fee_claimer);
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const website = typeof row?.website === "string" ? row.website.trim() : "";
    if (!fc || !name || !/^https?:\/\//i.test(website)) continue;
    if (existingLabels[fc]?.label) continue;
    const slug = slugFromName(name) || "partner";
    const pda = pk(row.pda);
    patch[fc] = {
      label: name,
      launchpadId: slug,
      website,
      evidence: pda
        ? `DBC PartnerMetadata PDA ${pda}: fee_claimer@8 == ${fc}; on-chain name=${name}, website=${website}`
        : `DBC PartnerMetadata: fee_claimer@8 == ${fc}; on-chain name=${name}, website=${website}`,
    };
  }
  return patch;
}
