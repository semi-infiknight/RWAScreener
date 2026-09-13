/** Resolve a stable category key for grouping Quotes UI. */

const KNOWN_LABELS: Record<string, string> = {
  xstocks: "xStocks",
  ondo: "Ondo",
  other: "Other",
};

/** Map free-form issuer/category strings → slug keys. */
export function categoryKeyFromRaw(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "other";
  const lower = raw.trim().toLowerCase();
  if (!lower) return "other";
  if (/x\s*-?\s*stocks?/.test(lower) || lower.includes("xstocks")) return "xstocks";
  if (/\bondo\b/.test(lower)) return "ondo";

  const slug = lower
    .replace(/^backed\s*[\/|]\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "other";
}

export function categoryLabel(key: string): string {
  const k = (key || "other").toLowerCase();
  if (KNOWN_LABELS[k]) return KNOWN_LABELS[k];
  return k
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

type WithCategoryMeta = {
  category?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Prefer explicit category, then meta.category, then meta.issuer, else other. */
export function resolveQuoteCategory(row: WithCategoryMeta): string {
  const meta = row.meta && typeof row.meta === "object" ? row.meta : {};
  const explicit =
    (typeof row.category === "string" && row.category.trim()) ||
    (typeof meta.category === "string" && String(meta.category).trim()) ||
    null;
  if (explicit) return categoryKeyFromRaw(explicit);
  const issuer =
    typeof meta.issuer === "string" ? String(meta.issuer).trim() : "";
  if (issuer) return categoryKeyFromRaw(issuer);
  return "other";
}
