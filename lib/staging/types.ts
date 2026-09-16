export type StagingSource = "postgres" | "file" | "empty";

export type QuoteMintRow = {
  mint: string;
  symbol: string;
  name: string;
  /** DAS / metadata image URL when known. */
  logo?: string | null;
  badge_verified_at: string | null;
  /** Optional seed category slug (e.g. xstocks, ondo). */
  category?: string | null;
  meta: Record<string, unknown>;
};

export type StagingLaunch = {
  address: string;
  config: string;
  base_mint: string;
  quote_mint: string;
  quote_symbol: string | null;
  creator: string | null;
  fee_claimer: string | null;
  launchpad_label: string | null;
  activation_at: string | null;
  created_at: string;
  /** graduated = CreatedPool only; bonding / migrating otherwise */
  status: "graduated" | "bonding" | "migrating";
};

export type StagingPartnerMetadata = {
  pda: string;
  name: string;
  website: string;
  logo?: string | null;
};

export type StagingLaunchpad = {
  fee_claimer: string;
  label: string | null;
  website: string | null;
  x: string | null;
  /** Proven seed label (launchpad-labels.json). */
  labeled: boolean;
  launchpadId: string | null;
  /** On-chain PartnerMetadata — evidence, not an auto-name for unlabeled rows. */
  partner_metadata: StagingPartnerMetadata | null;
  pool_count: number;
  config_count: number;
  quote_mint_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  sample_quote_symbols: string[];
};

export type StagingQuote = {
  mint: string;
  symbol: string;
  name: string;
  logo?: string | null;
  badge_verified_at: string | null;
  /** Grouping key for Quotes UI (xstocks, ondo, other, …). */
  category: string;
  pool_count: number;
  last_launch_at: string | null;
};

export type StagingListMeta = {
  source: StagingSource;
  generated_at: string | null;
  cutoff_iso: string;
  allowlist_count: number;
  count: number;
  labeled_count?: number;
  unlabeled_count?: number;
  unlabeled_pool_count?: number;
};
