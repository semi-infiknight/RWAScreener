import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bs58 from "bs58";
import { fileURLToPath } from "node:url";
import { DBC_021_CUTOFF_ISO, DBC_PROGRAM_ID } from "./constants.mjs";
import { loadQuoteMints, quoteMintSet } from "./quote-mints.mjs";
import { loadDotEnv, ROOT } from "./env.mjs";
import { heliusRpc, mapPool, sleep } from "./helius.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Anchor discriminators for DBC initialize instructions. */
const INIT_DISC_HEX = new Set(
  [
    "initialize_virtual_pool_with_spl_token",
    "initialize_virtual_pool_with_token2022",
    "initialize_virtual_pool_with_token2022_transfer_hook",
  ].map((name) =>
    crypto.createHash("sha256").update(`global:${name}`).digest("hex").slice(0, 16),
  ),
);

const POOL_CONFIG_DISC = Buffer.from([26, 108, 14, 123, 116, 230, 129, 43]);
const VIRTUAL_POOL_DISC = Buffer.from([213, 224, 5, 209, 98, 69, 119, 92]);
const TRANSFER_HOOK_POOL_DISC = Buffer.from([237, 219, 184, 23, 42, 189, 169, 35]);

/** PoolState.config offset = 8 (account disc) + 64 (volatility_tracker). */
const POOL_CONFIG_FIELD_OFFSET = 72;
/** PoolState.activation_point offset. */
const POOL_ACTIVATION_OFFSET = 296;
/** PoolConfig.activation_type offset. */
const CONFIG_ACTIVATION_TYPE_OFFSET = 234;
/** PoolConfig.fee_claimer offset. */
const CONFIG_FEE_CLAIMER_OFFSET = 40;

const ACTIVATION_SLOT = 0;
const ACTIVATION_TIMESTAMP = 1;

const DEFAULT_ARTIFACT = path.join(ROOT, "data", "dbc-backfill-result.json");

function discB58(buf) {
  return bs58.encode(buf);
}

function readPk(buf, offset) {
  return bs58.encode(buf.subarray(offset, offset + 32));
}

function readU64LE(buf, offset) {
  return Number(buf.readBigUInt64LE(offset));
}

function resolveAccountKeys(message, meta) {
  if (message.staticAccountKeys) {
    const staticKeys = message.staticAccountKeys.map((k) =>
      typeof k === "string" ? k : k.pubkey || k.toString(),
    );
    const writable = (meta?.loadedAddresses?.writable || []).map((k) =>
      typeof k === "string" ? k : k.toString(),
    );
    const readonly = (meta?.loadedAddresses?.readonly || []).map((k) =>
      typeof k === "string" ? k : k.toString(),
    );
    return [...staticKeys, ...writable, ...readonly];
  }
  return (message.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k.pubkey || k.toString(),
  );
}

function ixDataBuffer(data) {
  if (!data) return null;
  if (Array.isArray(data)) return Buffer.from(data);
  if (typeof data === "string") {
    try {
      return Buffer.from(bs58.decode(data));
    } catch {
      try {
        return Buffer.from(data, "base64");
      } catch {
        return null;
      }
    }
  }
  if (data instanceof Uint8Array) return Buffer.from(data);
  return null;
}

/**
 * Extract InitializeVirtualPool* account metas from a confirmed transaction.
 * Account order (SPL / Token2022): config, pool_authority, creator, base_mint, quote_mint, pool, …
 */
export function extractInitializeFromTx(tx, programId) {
  if (!tx?.transaction?.message) return null;
  const message = tx.transaction.message;
  const meta = tx.meta;
  const keys = resolveAccountKeys(message, meta);
  const compiled = message.compiledInstructions || message.instructions || [];

  const consider = (ix) => {
    const programIdIndex =
      ix.programIdIndex !== undefined ? ix.programIdIndex : keys.indexOf(ix.programId);
    const pid = keys[programIdIndex];
    if (pid !== programId) return null;
    const data = ixDataBuffer(ix.data);
    if (!data || data.length < 8) return null;
    const hex = data.subarray(0, 8).toString("hex");
    if (!INIT_DISC_HEX.has(hex)) return null;
    const idxs = ix.accountKeyIndexes || ix.accounts || [];
    const at = (i) => {
      const raw = idxs[i];
      if (typeof raw === "number") return keys[raw];
      return typeof raw === "string" ? raw : raw?.toString?.();
    };
    return {
      config: at(0),
      creator: at(2),
      base_mint: at(3),
      quote_mint: at(4),
      pool: at(5),
      disc: hex,
    };
  };

  for (const ix of compiled) {
    const hit = consider(ix);
    if (hit) return hit;
  }
  for (const inner of meta?.innerInstructions || []) {
    for (const ix of inner.instructions || []) {
      const hit = consider(ix);
      if (hit) return hit;
    }
  }
  return null;
}

async function getProgramAccountsFiltered(apiKey, programId, filters, dataSlice) {
  const opts = { encoding: "base64", filters };
  if (dataSlice) opts.dataSlice = dataSlice;
  return heliusRpc(apiKey, "getProgramAccounts", [programId, opts]);
}

/**
 * Discover PoolConfig accounts whose quote_mint is in the allowlist (Helius gPA + memcmp).
 */
async function discoverStockQuoteConfigs(apiKey, programId, quoteMints, concurrency) {
  const configDisc = discB58(POOL_CONFIG_DISC);
  const configs = [];
  await mapPool(quoteMints, concurrency, async (mint) => {
    const rows = await getProgramAccountsFiltered(apiKey, programId, [
      { memcmp: { offset: 0, bytes: configDisc } },
      { memcmp: { offset: 8, bytes: mint } },
    ]);
    for (const row of rows || []) {
      const data = Buffer.from(row.account.data[0], "base64");
      configs.push({
        address: row.pubkey,
        quote_mint: mint,
        fee_claimer: readPk(data, CONFIG_FEE_CLAIMER_OFFSET),
        activation_type: data[CONFIG_ACTIVATION_TYPE_OFFSET] ?? ACTIVATION_TIMESTAMP,
        raw_len: data.length,
      });
    }
  });
  return configs;
}

/**
 * Resolve VirtualPool (+ TransferHookPool) accounts for a config.
 */
async function poolsForConfig(apiKey, programId, configAddress) {
  const out = [];
  for (const disc of [VIRTUAL_POOL_DISC, TRANSFER_HOOK_POOL_DISC]) {
    const rows = await getProgramAccountsFiltered(
      apiKey,
      programId,
      [
        { memcmp: { offset: 0, bytes: discB58(disc) } },
        { memcmp: { offset: POOL_CONFIG_FIELD_OFFSET, bytes: configAddress } },
      ],
      // full account needed for creator/base_mint; fetch without slice
    );
    // Re-fetch without dataSlice — above used no slice when dataSlice omitted.
    for (const row of rows || []) {
      const data = Buffer.from(row.account.data[0], "base64");
      out.push({
        address: row.pubkey,
        config: configAddress,
        creator: readPk(data, 104),
        base_mint: readPk(data, 136),
        activation_point: readU64LE(data, POOL_ACTIVATION_OFFSET),
        kind: disc.equals(VIRTUAL_POOL_DISC) ? "virtualPool" : "transferHookPool",
      });
    }
  }
  return out;
}

/**
 * Walk getSignaturesForAddress on the pool, take the oldest signature, fetch tx, parse initialize.
 */
async function fetchInitializeForPool(apiKey, programId, poolAddress) {
  // Paginate to the oldest signature (initialize is the first tx on a fresh pool PDA).
  let before;
  let oldest = null;
  for (let page = 0; page < 50; page++) {
    const opts = { limit: 1000 };
    if (before) opts.before = before;
    const sigs = await heliusRpc(apiKey, "getSignaturesForAddress", [poolAddress, opts]);
    if (!sigs?.length) break;
    oldest = sigs[sigs.length - 1];
    if (sigs.length < 1000) break;
    before = sigs[sigs.length - 1].signature;
  }
  if (!oldest?.signature) return null;

  const tx = await heliusRpc(apiKey, "getTransaction", [
    oldest.signature,
    { encoding: "json", maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx) return null;
  const parsed = extractInitializeFromTx(tx, programId);
  if (!parsed) return null;
  return {
    signature: oldest.signature,
    slot: tx.slot ?? oldest.slot,
    blockTime: tx.blockTime ?? oldest.blockTime,
    ...parsed,
  };
}

function passesCutoff(init, activationType, activationPoint, cutoffUnix, cutoffSlot) {
  // Prefer initialize tx timing (created_at).
  if (init?.blockTime != null && cutoffUnix != null) {
    if (init.blockTime < cutoffUnix) return false;
  }
  if (init?.slot != null && cutoffSlot != null) {
    if (init.slot < cutoffSlot) return false;
  }
  // Secondary: pool activation_point vs cutoff (type-aware).
  if (activationType === ACTIVATION_TIMESTAMP && cutoffUnix != null) {
    if (activationPoint < cutoffUnix) return false;
  }
  if (activationType === ACTIVATION_SLOT && cutoffSlot != null) {
    if (activationPoint < cutoffSlot) return false;
  }
  // If only ISO cutoff and activation is slot-typed with no CUTOFF_SLOT, rely on init.blockTime only.
  return true;
}

function createdAtIso(init, activationType, activationPoint) {
  if (init?.blockTime != null) return new Date(init.blockTime * 1000).toISOString();
  if (activationType === ACTIVATION_TIMESTAMP && activationPoint > 1_000_000_000) {
    return new Date(activationPoint * 1000).toISOString();
  }
  return null;
}

/**
 * One-shot DBC initialize backfill (SPEC §5.2 / §8).
 *
 * Walk:
 * 1. Helius getProgramAccounts — PoolConfig memcmp quote_mint ∈ seed
 * 2. Helius getProgramAccounts — VirtualPool / TransferHookPool by config
 * 3. getSignaturesForAddress(pool) → getTransaction(oldest) → parse InitializeVirtualPool*
 * 4. Keep only quote_mint ∈ seed and created_at ≥ cutoff (blockTime / slot)
 *
 * Fail closed when HELIUS_API_KEY is missing — never invents pools.
 */
export async function backfillOnce(opts = {}) {
  loadDotEnv(opts.root || ROOT);

  const heliusApiKey = (opts.heliusApiKey ?? process.env.HELIUS_API_KEY ?? "").trim();
  const programId = (opts.programId ?? process.env.DBC_PROGRAM_ID ?? DBC_PROGRAM_ID).trim();
  const cutoffIso = (opts.cutoffIso ?? process.env.DBC_021_CUTOFF_ISO ?? DBC_021_CUTOFF_ISO).trim();
  const cutoffSlotRaw = (opts.cutoffSlot ?? process.env.DBC_021_CUTOFF_SLOT ?? "").trim();
  const cutoffSlot = cutoffSlotRaw ? Number(cutoffSlotRaw) : null;
  const cutoffUnix = Math.floor(new Date(cutoffIso).getTime() / 1000);
  const concurrency = opts.concurrency ?? Number(process.env.DBC_BACKFILL_CONCURRENCY || 3);
  const writeArtifact = opts.writeArtifact !== false;
  const artifactPath = opts.artifactPath || DEFAULT_ARTIFACT;

  const allowlist = loadQuoteMints(opts.seedPath);
  const allowSet = quoteMintSet(opts.seedPath);
  const allowlistCount = allowlist.length;

  const empty = {
    ok: true,
    programId,
    cutoffIso,
    cutoffSlot,
    allowlistCount,
    pools: [],
    configs: [],
    fee_claimer_labels: {},
    stats: {
      configsScanned: 0,
      poolsScanned: 0,
      initializeParsed: 0,
      skippedBeforeCutoff: 0,
      skippedBadQuote: 0,
      skippedNoInitialize: 0,
    },
  };

  if (!heliusApiKey) {
    return {
      ...empty,
      skipped: true,
      reason: "HELIUS_API_KEY missing — fail closed, no pools invented",
    };
  }

  if (!Number.isFinite(cutoffUnix)) {
    return {
      ...empty,
      ok: false,
      skipped: true,
      reason: `Invalid DBC_021_CUTOFF_ISO: ${cutoffIso}`,
    };
  }

  const quoteMints = allowlist.map((r) => r.mint);
  const configsFound = await discoverStockQuoteConfigs(
    heliusApiKey,
    programId,
    quoteMints,
    concurrency,
  );
  empty.stats.configsScanned = configsFound.length;

  const configByAddress = new Map(configsFound.map((c) => [c.address, c]));

  // Resolve pools per config (bounded concurrency).
  const poolCandidates = [];
  await mapPool(configsFound, concurrency, async (cfg) => {
    const pools = await poolsForConfig(heliusApiKey, programId, cfg.address);
    for (const p of pools) poolCandidates.push({ ...p, quote_mint: cfg.quote_mint, fee_claimer: cfg.fee_claimer, activation_type: cfg.activation_type });
  });
  empty.stats.poolsScanned = poolCandidates.length;

  const poolsOut = [];
  const configsOutMap = new Map();

  await mapPool(poolCandidates, concurrency, async (cand) => {
    let init = null;
    try {
      init = await fetchInitializeForPool(heliusApiKey, programId, cand.address);
    } catch (e) {
      // Soft-fail one pool; do not invent.
      empty.stats.skippedNoInitialize += 1;
      return;
    }
    if (!init) {
      empty.stats.skippedNoInitialize += 1;
      return;
    }
    empty.stats.initializeParsed += 1;

    const quote = init.quote_mint || cand.quote_mint;
    if (!allowSet.has(quote)) {
      empty.stats.skippedBadQuote += 1;
      return;
    }

    if (
      !passesCutoff(
        init,
        cand.activation_type,
        cand.activation_point,
        cutoffUnix,
        cutoffSlot,
      )
    ) {
      empty.stats.skippedBeforeCutoff += 1;
      return;
    }

    const created_at = createdAtIso(init, cand.activation_type, cand.activation_point);
    const configAddress = init.config || cand.config;
    const fee_claimer =
      configByAddress.get(configAddress)?.fee_claimer || cand.fee_claimer || null;

    if (!configsOutMap.has(configAddress)) {
      configsOutMap.set(configAddress, {
        address: configAddress,
        quote_mint: quote,
        fee_claimer,
        first_seen_at: created_at,
        raw: {
          activation_type: cand.activation_type,
          source: "helius_initialize_tx",
          initialize_signature: init.signature,
        },
      });
    }

    poolsOut.push({
      address: init.pool || cand.address,
      config: configAddress,
      base_mint: init.base_mint || cand.base_mint,
      quote_mint: quote,
      creator: init.creator || cand.creator,
      activation_at:
        cand.activation_type === ACTIVATION_TIMESTAMP && cand.activation_point > 1_000_000_000
          ? new Date(cand.activation_point * 1000).toISOString()
          : null,
      created_at,
      status: "curve",
      raw: {
        kind: cand.kind,
        slot: init.slot,
        blockTime: init.blockTime,
        initialize_signature: init.signature,
        activation_point: cand.activation_point,
        activation_type: cand.activation_type,
        source: "helius_initialize_tx",
      },
    });
  });

  // Stable sort: newest first
  poolsOut.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const configsOut = [...configsOutMap.values()].sort((a, b) =>
    a.address.localeCompare(b.address),
  );

  const result = {
    ok: true,
    skipped: false,
    stub: false,
    programId,
    cutoffIso,
    cutoffSlot,
    allowlistCount,
    pools: poolsOut,
    configs: configsOut,
    // Observed fee_claimers are on configs; labels stay empty unless known (SPEC / launchpad-labels).
    fee_claimer_labels: {},
    stats: empty.stats,
    reason: `Helius initialize-tx walk complete — ${poolsOut.length} stock-quote pool(s)`,
  };

  if (writeArtifact) {
    try {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(
        artifactPath,
        JSON.stringify(
          {
            _comment:
              "Generated by packages/dbc backfillOnce — gitignored. Not a seed; do not treat as SoT over on-chain.",
            generated_at: new Date().toISOString(),
            ...result,
          },
          null,
          2,
        ),
      );
      result.artifactPath = artifactPath;
    } catch (e) {
      result.artifactError = String(e?.message || e);
    }
  }

  return result;
}
