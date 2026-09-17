/**
 * Adversarial probe of the shipped classifier.
 * Measures: paraphrase, keyword traps, near-miss buckets, OOD.
 * Run: npx tsx scripts/probe-intelligence.ts
 */
import {
  buildClassificationDocument,
  classifyText,
  warmupClassifier,
  type Classification,
} from "../src/classifier.js";
import type { BucketId } from "../src/buckets.js";

type Case = {
  id: string;
  group: "easy" | "paraphrase" | "trap" | "near" | "ood";
  text: string;
  bio?: string;
  expect: BucketId | BucketId[];
};

const CASES: Case[] = [
  // --- easy (in-distribution) ---
  {
    id: "easy-sdk",
    group: "easy",
    text: "npm i @meteora-ag/dynamic-bonding-curve-sdk and the CPI is landing on devnet",
    bio: "solana engineer",
    expect: "builder_integrating_sdk",
  },
  {
    id: "easy-help",
    group: "easy",
    text: "Does anyone know who at Meteora helps launchpads with partner configs?",
    expect: "pad_migrating_or_exploring",
  },
  {
    id: "easy-noise",
    group: "easy",
    text: "MET 100x LFG buy now or cry later",
    expect: "noise_retail_hype",
  },
  {
    id: "easy-scaffold",
    group: "easy",
    text: "Cloned the Fun Launch Next.js template from Invent, wiring our pool config key",
    expect: "scaffold_forker",
  },
  {
    id: "easy-live",
    group: "easy",
    text: "Proud to announce our pad is live on Meteora DBC — creators launching today",
    expect: "pad_live_on_dbc",
  },
  {
    id: "easy-pain",
    group: "easy",
    text: "Another pump.fun graduation sniped to zero. These pads have no locked LP story.",
    expect: "competitor_pain",
  },
  {
    id: "para-pain",
    group: "paraphrase",
    text: "Moonit snipers wrecked another launch. Graduation UX is a joke and nobody locks LP.",
    expect: "competitor_pain",
  },
  {
    id: "easy-bot",
    group: "easy",
    text: "Indexing new Meteora DBC pools for our sniper / copy-trade bot",
    expect: "infra_bot_indexer",
  },
  {
    id: "easy-vault",
    group: "easy",
    text: "Using Alpha Vault for a fair launch then DAMM with locked LP fee claims",
    expect: "lp_alpha_vault_launch",
  },
  {
    id: "easy-token",
    group: "easy",
    text: "We just want a branded bonding curve page for our one ticker, not a launchpad company",
    expect: "token_team_wants_pad",
  },
  {
    id: "easy-t22",
    group: "easy",
    text: "Building Token-2022 transfer-hook launches on DBC with a custom USDC quote mint",
    expect: "vertical_quote_meta",
  },

  // --- paraphrase (same intent, different words) ---
  {
    id: "para-help",
    group: "paraphrase",
    text: "We're a small pad on Moonit. Is Meteora DBC worth switching to and can we get an intro?",
    expect: "pad_migrating_or_exploring",
  },
  {
    id: "para-sdk",
    group: "paraphrase",
    text: "Spent the weekend in the DBC TS client, account metas for swap are still biting me",
    bio: "anchor enjoyooor",
    expect: "builder_integrating_sdk",
  },
  {
    id: "para-noise",
    group: "paraphrase",
    text: "chart looking juicy, meteora szn incoming, points when ser",
    expect: "noise_retail_hype",
  },
  {
    id: "para-live",
    group: "paraphrase",
    text: "First creator tokens already graduated off our platform into DAMM v2. We're in production.",
    expect: "pad_live_on_dbc",
  },

  // --- keyword traps (tech words, wrong intent) ---
  {
    id: "trap-dbc-moon",
    group: "trap",
    text: "DBC coin about to explode, Meteora DBC 100x, ape in",
    expect: "noise_retail_hype",
  },
  {
    id: "trap-sdk-shill",
    group: "trap",
    text: "Just found the Meteora SDK lmao this token is going to 50x",
    expect: "noise_retail_hype",
  },
  {
    id: "trap-launchpad-price",
    group: "trap",
    text: "Best launchpad on solana?? MET pumps hard after every DBC launch",
    expect: "noise_retail_hype",
  },
  {
    id: "trap-help-is-live",
    group: "trap",
    text: "We already integrated DBC last month. Creators are live. Not looking for help.",
    expect: "pad_live_on_dbc",
  },

  // --- near-miss / mixed intent ---
  {
    id: "near-sdk-vs-live",
    group: "near",
    text: "Shipping our launchpad on Meteora DBC this week — PoolConfig + dynamic-bonding-curve-sdk CPI done",
    expect: ["builder_integrating_sdk", "pad_live_on_dbc"],
  },
  {
    id: "near-rwa-scaffold",
    group: "near",
    text: "Forked Fun Launch and swapping the quote mint to an RWA / xStocks pair",
    expect: ["scaffold_forker", "vertical_quote_meta"],
  },
  {
    id: "near-bot-vs-pad",
    group: "near",
    text: "Dashboard of DBC graduations for traders, not a launchpad",
    expect: "infra_bot_indexer",
  },

  // --- out of domain ---
  {
    id: "ood-weather",
    group: "ood",
    text: "Nice weather in Lisbon today, grabbing coffee",
    expect: "noise_retail_hype",
  },
  {
    id: "ood-unrelated-crypto",
    group: "ood",
    text: "Ethereum gas is high again, L2s are the only way",
    expect: "noise_retail_hype",
  },
];

function allowed(c: Case): BucketId[] {
  return Array.isArray(c.expect) ? c.expect : [c.expect];
}

function hit(c: Case, cls: Classification): boolean {
  return allowed(c).includes(cls.primary);
}

function margin(cls: Classification): number {
  return cls.signalScore - cls.noiseScore;
}

async function main() {
  console.log("Probing BGE-small prototype classifier…\n");
  await warmupClassifier();

  const rows: {
    id: string;
    group: string;
    ok: boolean;
    primary: string;
    expect: string;
    conf: number;
    margin: number;
    lead: number;
    suppressed: boolean;
    signal: number;
    noise: number;
    gated: boolean;
  }[] = [];

  for (const c of CASES) {
    const cls = await classifyText(
      buildClassificationDocument({
        text: c.text,
        authorBio: c.bio,
      }),
    );
    rows.push({
      id: c.id,
      group: c.group,
      ok: hit(c, cls),
      primary: cls.primary,
      expect: allowed(c).join("|"),
      conf: cls.primaryScore,
      margin: margin(cls),
      lead: cls.leadScore,
      suppressed: cls.suppressed,
      signal: cls.signalScore,
      noise: cls.noiseScore,
      gated: cls.gatedAsNoise,
    });
  }

  const byGroup = new Map<string, { n: number; hits: number; margins: number[] }>();
  for (const r of rows) {
    const g = byGroup.get(r.group) ?? { n: 0, hits: 0, margins: [] };
    g.n++;
    if (r.ok) g.hits++;
    g.margins.push(r.margin);
    byGroup.set(r.group, g);
  }

  console.log(
    "id".padEnd(22) +
      "ok".padEnd(5) +
      "got".padEnd(28) +
      "sig".padEnd(7) +
      "noi".padEnd(7) +
      "gateΔ".padEnd(8) +
      "expect",
  );
  for (const r of rows) {
    const mark = r.ok ? "Y" : "N";
    console.log(
      r.id.padEnd(22) +
        mark.padEnd(5) +
        r.primary.padEnd(28) +
        r.signal.toFixed(3).padEnd(7) +
        r.noise.toFixed(3).padEnd(7) +
        r.margin.toFixed(3).padEnd(8) +
        r.expect,
    );
  }

  console.log("\n--- by group ---");
  let hits = 0;
  for (const [g, s] of byGroup) {
    hits += s.hits;
    const avgM = s.margins.reduce((a, b) => a + b, 0) / s.margins.length;
    console.log(
      `${g.padEnd(12)} ${s.hits}/${s.n}  (${((100 * s.hits) / s.n).toFixed(0)}%)  avg margin ${avgM.toFixed(3)}`,
    );
  }
  const n = rows.length;
  const rate = hits / n;
  const avgMargin = rows.reduce((a, r) => a + r.margin, 0) / n;
  const tight = rows.filter((r) => Math.abs(r.margin) < 0.05).length;
  const noiseOk = rows.filter((r) => r.expect.includes("noise") && r.ok).length;
  const noiseN = rows.filter((r) => r.expect.includes("noise")).length;
  const builderRows = rows.filter((r) => !r.expect.includes("noise"));
  const minBuilderGate = Math.min(...builderRows.map((r) => r.margin));

  console.log("\n--- summary ---");
  console.log(`accuracy     ${(100 * rate).toFixed(0)}%  (${hits}/${n})`);
  console.log(`avg gateΔ    ${avgMargin.toFixed(3)}   (|Δ|<0.05 tight: ${tight}/${n})`);
  console.log(`min builder gateΔ ${minBuilderGate.toFixed(3)}`);
  console.log(`noise traps  ${noiseOk}/${noiseN} correctly suppressed-or-bucketed as noise`);

  // Rough intelligence band for this architecture
  let grade: string;
  if (rate >= 0.85 && avgMargin >= 0.04) grade = "B+  sharp on this taxonomy, still a scanner not an analyst";
  else if (rate >= 0.75) grade = "B   semantic enough for lead ranking; near-intents blur";
  else if (rate >= 0.6) grade = "C+  better than keywords; prototype collisions";
  else grade = "C   geometry not holding — examples or model need work";

  console.log(`grade        ${grade}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
