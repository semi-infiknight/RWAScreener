import { loadLaunchpadLabels } from "./allowlist";
import { partnerMetadataFor } from "./partner-metadata";
import type { StagingLaunchpad, StagingListMeta } from "./types";

export function decorateLaunchpad(
  lp: Omit<
    StagingLaunchpad,
    "labeled" | "launchpadId" | "partner_metadata"
  > &
    Partial<Pick<StagingLaunchpad, "labeled" | "launchpadId" | "partner_metadata">>,
): StagingLaunchpad {
  const labels = loadLaunchpadLabels();
  const lab = lp.fee_claimer !== "unknown" ? labels[lp.fee_claimer] : undefined;
  const labeled = Boolean(lab?.label || lp.label);
  return {
    ...lp,
    label: labeled ? (lp.label ?? lab?.label ?? null) : null,
    website: labeled ? (lp.website ?? lab?.website ?? null) : null,
    x: labeled ? (lp.x ?? lab?.x ?? null) : null,
    labeled,
    launchpadId: lab?.launchpadId ?? lp.launchpadId ?? null,
    partner_metadata: partnerMetadataFor(lp.fee_claimer),
  };
}

export function launchpadDeskStats(launchpads: StagingLaunchpad[]): Pick<
  StagingListMeta,
  "labeled_count" | "unlabeled_count" | "unlabeled_pool_count"
> {
  let labeled_count = 0;
  let unlabeled_count = 0;
  let unlabeled_pool_count = 0;
  for (const lp of launchpads) {
    if (lp.labeled) labeled_count += 1;
    else {
      unlabeled_count += 1;
      unlabeled_pool_count += lp.pool_count;
    }
  }
  return { labeled_count, unlabeled_count, unlabeled_pool_count };
}
