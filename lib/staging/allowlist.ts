import fs from "node:fs";
import { BLOCKED_QUOTE_MINTS } from "./constants";
import { dataPath } from "./paths";
import type { QuoteMintRow } from "./types";

let cached: QuoteMintRow[] | null = null;
let cachedSet: Set<string> | null = null;

export function loadQuoteAllowlist(): QuoteMintRow[] {
  if (cached) return cached;
  const file = dataPath("quote-mints.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      quote_mints?: QuoteMintRow[];
    };
    const rows = Array.isArray(raw.quote_mints) ? raw.quote_mints : [];
    cached = rows
      .filter(
        (r) =>
          typeof r?.mint === "string" &&
          r.mint.length > 0 &&
          !BLOCKED_QUOTE_MINTS.has(r.mint),
      )
      .map((r) => {
        const row = r as QuoteMintRow & { category?: string | null };
        const meta =
          row.meta && typeof row.meta === "object" ? { ...row.meta } : {};
        const categoryFromMeta =
          typeof meta.category === "string" ? meta.category : null;
        const category =
          typeof row.category === "string" ? row.category : categoryFromMeta;
        if (category && !meta.category) meta.category = category;
        return {
          mint: row.mint,
          symbol: row.symbol ?? "",
          name: row.name ?? "",
          badge_verified_at: row.badge_verified_at ?? null,
          category,
          meta,
        };
      });
  } catch {
    cached = [];
  }
  return cached;
}

export function quoteAllowlistSet(): Set<string> {
  if (cachedSet) return cachedSet;
  cachedSet = new Set(loadQuoteAllowlist().map((r) => r.mint));
  return cachedSet;
}

export function isAllowedQuoteMint(mint: string | null | undefined): boolean {
  if (!mint) return false;
  if (BLOCKED_QUOTE_MINTS.has(mint)) return false;
  return quoteAllowlistSet().has(mint);
}

export type LaunchpadLabel = {
  label: string;
  website?: string | null;
  launchpadId?: string;
  notes?: string;
};

export function loadLaunchpadLabels(): Record<string, LaunchpadLabel> {
  const out: Record<string, LaunchpadLabel> = {};
  for (const file of ["launchpad-labels.json", "fee-claimer-attribution.json"]) {
    try {
      const raw = JSON.parse(fs.readFileSync(dataPath(file), "utf8")) as Record<
        string,
        unknown
      >;
      const map =
        (raw.fee_claimer_labels as Record<string, LaunchpadLabel> | undefined) ||
        (raw.proven_labels as Record<string, LaunchpadLabel> | undefined) ||
        {};
      for (const [k, v] of Object.entries(map)) {
        if (!v?.label) continue;
        if (!out[k]) {
          out[k] = {
            label: v.label,
            website: v.website ?? null,
            launchpadId: v.launchpadId,
            notes:
              typeof (v as { evidence?: string }).evidence === "string"
                ? (v as { evidence?: string }).evidence
                : undefined,
          };
        } else if (v.website && !out[k].website) {
          out[k].website = v.website;
        }
      }
    } catch {
      /* optional file */
    }
  }
  return out;
}
