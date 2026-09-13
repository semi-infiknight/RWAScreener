/**
 * Staging pool lifecycle labels (Semi product lock).
 * graduated ⟺ CreatedPool (migration_progress === 3) only.
 * PostBondingCurve / LockedVesting → migrating (not graduated).
 * PreBondingCurve / unknown → bonding. Fail closed.
 */

export type StagingPoolStatus = "graduated" | "bonding" | "migrating";

/** Meteora DBC MigrationProgress enum */
export const MigrationProgress = {
  PreBondingCurve: 0,
  PostBondingCurve: 1,
  LockedVesting: 2,
  CreatedPool: 3,
} as const;

export function statusFromMigrationProgress(
  migrationProgress: number | null | undefined,
): StagingPoolStatus | null {
  if (migrationProgress == null || !Number.isFinite(migrationProgress)) {
    return null;
  }
  if (migrationProgress === MigrationProgress.CreatedPool) return "graduated";
  if (
    migrationProgress === MigrationProgress.PostBondingCurve ||
    migrationProgress === MigrationProgress.LockedVesting
  ) {
    return "migrating";
  }
  if (migrationProgress === MigrationProgress.PreBondingCurve) return "bonding";
  return "bonding";
}

/**
 * Normalize a stored status (+ optional raw.migration_progress) to the lock.
 * Progress byte wins when present. Legacy "curve" → bonding.
 * A bare "graduated" without progress is kept only if already stored that way
 * (CreatedPool-only writers); never invent graduated from age/mcap.
 */
export function normalizeStagingStatus(
  status: string | null | undefined,
  raw?: { migration_progress?: number | null; migrationProgress?: number | null } | null,
): StagingPoolStatus {
  const progress =
    raw?.migration_progress ?? raw?.migrationProgress ?? null;
  const fromProgress = statusFromMigrationProgress(
    typeof progress === "number" ? progress : null,
  );
  if (fromProgress) return fromProgress;

  const s = (status || "").toLowerCase();
  if (s === "graduated") return "graduated";
  if (s === "migrating" || s === "post_bonding" || s === "locked_vesting") {
    return "migrating";
  }
  // curve / bonding / empty / anything else
  return "bonding";
}
