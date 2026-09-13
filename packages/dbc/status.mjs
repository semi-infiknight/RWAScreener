/**
 * Pool status from on-chain VirtualPool / TransferHookPool account data.
 *
 * Staging graduated = CreatedPool ONLY (DAMM live).
 * NOT graduated: PreBondingCurve, PostBondingCurve, LockedVesting.
 * Fail closed → "curve" unless migration_progress === CreatedPool (3).
 *
 * Layout: Anchor 8-byte disc + PoolState (IDL / Meteora DBC program).
 *   is_migrated @ 305, migration_progress @ 308
 * MigrationProgress: 0 PreBondingCurve, 1 PostBondingCurve, 2 LockedVesting, 3 CreatedPool
 */
export const POOL_IS_MIGRATED_OFFSET = 305;
export const POOL_MIGRATION_PROGRESS_OFFSET = 308;

/** @enum {number} */
export const MigrationProgress = {
  PreBondingCurve: 0,
  PostBondingCurve: 1,
  LockedVesting: 2,
  CreatedPool: 3,
};

/**
 * @param {Buffer|Uint8Array|null|undefined} data full account data (incl. disc)
 * @returns {{ status: "graduated"|"curve", migration_progress: number|null, is_migrated: number|null }}
 */
export function poolStatusFromAccountData(data) {
  if (!data || data.length <= POOL_MIGRATION_PROGRESS_OFFSET) {
    return { status: "curve", migration_progress: null, is_migrated: null };
  }
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const is_migrated = buf[POOL_IS_MIGRATED_OFFSET];
  const migration_progress = buf[POOL_MIGRATION_PROGRESS_OFFSET];
  // CreatedPool only — do not graduate on PostBondingCurve / LockedVesting / is_migrated alone
  // (is_migrated is set in update_after_create_pool, but progress enum is the SoT Semi locked).
  const status =
    migration_progress === MigrationProgress.CreatedPool ? "graduated" : "curve";
  return { status, migration_progress, is_migrated };
}

/**
 * Map already-parsed progress byte to status (fail closed).
 * @param {number|null|undefined} migrationProgress
 */
export function statusFromMigrationProgress(migrationProgress) {
  return migrationProgress === MigrationProgress.CreatedPool ? "graduated" : "curve";
}
