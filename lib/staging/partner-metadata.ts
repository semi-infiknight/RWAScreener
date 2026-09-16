import fs from "node:fs";
import { dataPath } from "./paths";

export type PartnerMetadataRow = {
  pda: string;
  name: string;
  website: string;
  logo?: string | null;
};

let cached: Record<string, PartnerMetadataRow> | null = null;

/** Observed PartnerMetadata keyed by fee_claimer. Missing file → empty (fail closed). */
export function loadPartnerMetadata(): Record<string, PartnerMetadataRow> {
  if (cached) return cached;
  const out: Record<string, PartnerMetadataRow> = {};
  try {
    const raw = JSON.parse(
      fs.readFileSync(dataPath("partner-metadata.json"), "utf8"),
    ) as {
      by_fee_claimer?: Record<string, PartnerMetadataRow>;
    };
    const map = raw.by_fee_claimer || {};
    for (const [fc, row] of Object.entries(map)) {
      if (!fc || !row?.pda || !row?.name || !row?.website) continue;
      out[fc] = {
        pda: row.pda,
        name: row.name,
        website: row.website,
        logo: row.logo ?? null,
      };
    }
  } catch {
    /* optional seed */
  }
  cached = out;
  return out;
}

export function partnerMetadataFor(feeClaimer: string | null | undefined) {
  if (!feeClaimer || feeClaimer === "unknown") return null;
  return loadPartnerMetadata()[feeClaimer] ?? null;
}
