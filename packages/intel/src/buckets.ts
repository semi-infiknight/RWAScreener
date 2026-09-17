export type BucketId =
  | "builder_integrating_sdk"
  | "scaffold_forker"
  | "pad_migrating_or_exploring"
  | "vertical_quote_meta"
  | "pad_live_on_dbc"
  | "pad_ecosystem_drama"
  | "token_team_wants_pad"
  | "hackathon_builder"
  | "ecosystem_integration"
  | "infra_bot_indexer"
  | "lp_alpha_vault_launch"
  | "competitor_pain"
  | "memes_meteora_ecosystem"
  | "official_meteora"
  | "noise_retail_hype";

/** Official Meteora accounts — classified into their own lane by handle, not semantics. */
export const OFFICIAL_HANDLES = new Set(["meteoraag", "meteoraeco"]);

export type Bucket = {
  id: BucketId;
  label: string;
  /** Rich semantic description used for embedding-based classification */
  description: string;
  /** Prototype utterances — embedded and max-pooled with the description */
  examples: string[];
  /** Higher = more valuable BD lead when this is primary */
  leadWeight: number;
  suppress?: boolean;
  /** Never wins embedding similarity — assigned only by handle/rule override */
  overrideOnly?: boolean;
};

/**
 * Builder/tech-first buckets for Meteora DBC & related launch tech.
 * Descriptions + examples are embedded so BGE-small similarity can separate
 * builders from retail hype without brittle keyword rules.
 */
export const BUCKETS: Bucket[] = [
  {
    id: "builder_integrating_sdk",
    label: "Builder integrating SDK / CPI",
    leadWeight: 1.0,
    description:
      "Hands-on engineering against the DBC program: npm SDK, CPI, PoolConfig accounts, TypeScript, tx debugging. Code is shipping. Not a question asking how to start.",
    examples: [
      "Wired @meteora-ag/dynamic-bonding-curve-sdk CPI and PoolConfig — txs landing",
      "Debugging DBC program ID accounts in our TypeScript client",
      "Finished the on-chain partner config in code, graduating pools to DAMM v2 from our SDK",
      "Stuck on DBC swap account metas in the TypeScript client after a weekend in the code",
      "npm install of the dynamic bonding curve SDK, CPI compiling, still mapping remaining accounts",
    ],
  },
  {
    id: "scaffold_forker",
    label: "Fun Launch / Invent scaffold",
    leadWeight: 0.95,
    description:
      "Someone forked or customized Meteora Invent Fun Launch scaffold or an open-source Meteora launchpad UI template to stand up their own pad frontend.",
    examples: [
      "Forked Fun Launch from Meteora Invent and customizing the trading UI",
      "Using the Meteora Invent scaffold to spin up our launchpad frontend",
      "Cloned the fun-launch Next.js template and wired our pool config key",
    ],
  },
  {
    id: "pad_migrating_or_exploring",
    label: "Launchpad exploring / migrating",
    leadWeight: 0.9,
    description:
      "A question or ask: looking for help, intros, or whether to migrate a launchpad onto Meteora DBC. Not yet coding. Seeking partners, not announcing a ship.",
    examples: [
      "Anyone have experience integrating Meteora DBC? Need partner config help for our launchpad",
      "Thinking of migrating our pad from pump to Meteora — looking for intros, not live yet",
      "Does Meteora help launchpads integrate? We want to partner, asking around",
    ],
  },
  {
    id: "vertical_quote_meta",
    label: "Vertical / quote-meta builder",
    leadWeight: 0.85,
    description:
      "Builders focused on Token-2022, transfer hooks, RWA, xStocks, perps, or custom quote mints for specialized vertical launchpads on Meteora DBC.",
    examples: [
      "DBC with a custom USDC quote mint for our RWA launchpad",
      "Token-2022 transfer hook launches graduating into DAMM v2",
      "Building an xStocks-style vertical pad on Meteora curves",
    ],
  },
  {
    id: "pad_live_on_dbc",
    label: "Launchpad live on DBC",
    leadWeight: 0.7,
    description:
      "A launchpad is already live on Meteora DBC: public announcement of production integration, creators launching today, tokens graduating to DAMM. Past tense / shipped / live — not asking how.",
    examples: [
      "Our launchpad is live on Meteora DBC — creators can launch today",
      "We shipped partner config and graduated the first pools to DAMM v2",
      "Proud to announce full Meteora Dynamic Bonding Curve integration in production",
      "DBC integration already shipped, creators are live, we do not need onboarding help",
      "Creator tokens on our platform are graduating into DAMM v2 — we are in production",
    ],
  },
  {
    id: "pad_ecosystem_drama",
    label: "Pad ecosystem drama / movement",
    leadWeight: 0.35,
    description:
      "Third-party talk about a specific Meteora ecosystem launchpad (Ember Curve, LFOwn, Bags, Perpspad, ClawPump, Ethics, RevShare, OTC Desks, StonkOptions): drama, traction, outages, graduations gone wrong, comparisons. Not the pad announcing itself (pad_live_on_dbc), not competitor pads (competitor_pain).",
    examples: [
      "Ember Curve graduations keep getting sniped — even DBC pads have this problem",
      "Bags.fm volume fell off a cliff this week",
      "Perpspad claims page is down again, anyone else seeing this",
      "LFOwn quietly shipped creator fee claims this week",
      "drama at ethics.ltd over the fee split change",
    ],
  },
  {
    id: "token_team_wants_pad",
    label: "Token team wants branded pad",
    leadWeight: 0.55,
    description:
      "A single memecoin or token team wants a branded curve page for one ticker. They are not building a multi-creator launchpad and are not asking to partner as a pad.",
    examples: [
      "We want a branded bonding curve page for our one token, not a launchpad business",
      "White-label DBC UI for a single project ticker — we are not launching other creators",
    ],
  },
  {
    id: "hackathon_builder",
    label: "Hackathon / bounty builder",
    leadWeight: 0.85,
    description:
      "A team building with Meteora DBC, DAMM, or DLMM specifically — Meteora hackathon track, bounty, or Colosseum/Superteam entry that uses Meteora launchpad tech. Generic hackathon posts with no Meteora product are noise.",
    examples: [
      "Submitting our DBC launchpad to the Meteora track at Colosseum this weekend",
      "Hackathon build using Meteora DAMM v2 for the liquidity prize",
      "Building on Meteora DBC for the Superteam bounty — demo day Friday",
      "Our Colosseum entry is a permissionless pad on Dynamic Bonding Curve",
      "We're in. ChainRot entered Stocklana — clip launches as a coin paired with a stock, powered by Meteora DBC",
      "Stocklana build: launchpad on Meteora DBC with tokenized stocks as the quote asset",
    ],
  },
  {
    id: "ecosystem_integration",
    label: "Ecosystem integration / partnership",
    leadWeight: 0.5,
    description:
      "An integration or partnership between Meteora tech and another protocol, wallet, aggregator, or tool — routing DAMM pools, wallet support, API/SDK partnerships. Movement between organizations, not a solo builder.",
    examples: [
      "Backpack wallet now surfaces Meteora DAMM pools in-app",
      "Jupiter routing adds our DBC graduation pools",
      "Partnered with a wallet to show bonded DBC positions natively",
    ],
  },
  {
    id: "memes_meteora_ecosystem",
    label: "Memes / ecosystem culture",
    leadWeight: 0.2,
    description:
      "Culture around Meteora permissionless launchpads: gud fee tek, builders will win, gladiators in the arena, experiments on Solana DBC, Ember/Perpspad energy. The posts @vesper792 would quote or reply to. Not LP army, not MET price calls, not generic crypto shitposts.",
    examples: [
      "if it's on solana, you can launch it on meteora dbc. builders will win.",
      "gladiators in the arena — early champions shipping on meteora dbc",
      "meteora dbc: solana's way of saying experiments, hold my beer",
      "gud fee tek permissionless launchpads on solana lmao",
      "ember curve live on dbc, more experiments please",
      "POV: you're a launchpad graduating to DAMM v2 and the snipers are already loading",
    ],
  },
  {
    id: "official_meteora",
    label: "Official Meteora",
    leadWeight: 0,
    overrideOnly: true,
    description:
      "Posts from official Meteora accounts (MeteoraAG, MeteoraEco) — announcements, docs, ecosystem updates. Context for the ecosystem, not a BD lead; assigned by handle override.",
    examples: [
      "Meteora announcement: new DBC features live",
      "MeteoraEco weekly ecosystem roundup",
    ],
  },
  {
    id: "infra_bot_indexer",
    label: "Infra / bot / indexer",
    leadWeight: 0.45,
    description:
      "Bots, snipers, indexers, or analytics indexing Meteora DBC/DAMM/DLMM pools for trading infra — not operating a launchpad.",
    examples: [
      "Indexing new Meteora DBC pools for our trading bot",
      "Built a dashboard for DAMM v2 graduation events",
    ],
  },
  {
    id: "lp_alpha_vault_launch",
    label: "Alpha Vault / fair launch LP",
    leadWeight: 0.4,
    description:
      "A builder designing a fair launch with Meteora Alpha Vault or DAMM fee scheduler — product mechanics, not LP-army farming, not MET LP yield spam.",
    examples: [
      "Using Meteora Alpha Vault for a fair launch before DAMM liquidity",
      "Fee scheduler anti-snipe on our DAMM pool for a DBC graduation",
    ],
  },
  {
    id: "competitor_pain",
    label: "Competitor pain / outbound signal",
    leadWeight: 0.75,
    description:
      "Frustration with snipers, broken graduation, fees, or UX on other launchpads — outbound signal to pitch Meteora DBC.",
    examples: [
      "Another launchpad graduation rug — snipers destroyed price discovery again",
      "Tired of pump-style launches with no locked LP or real migration story",
      "pump.fun graduation sniped to zero again, these pads have no locked LP",
      "Moonit and Raydium LaunchLab keep getting sniped — broken graduation UX, no real LP lock",
      "Sick of competitor pads with no migration story, snipers dump every launch",
    ],
  },
  {
    id: "noise_retail_hype",
    label: "Retail hype / noise",
    leadWeight: 0,
    suppress: true,
    description:
      "Price speculation, moon calls, MET chart spam, LP army yield farming, generic hackathon posts with no Meteora product, airdrop hype — no launchpad or builder substance.",
    examples: [
      "MET to the moon 100x buy the dip",
      "Who is buying Meteora token tonight LFG",
      "Airdrop farming meteora points when?",
      "Meteora DBC token going parabolic ape the 100x",
      "lmao they mentioned the SDK so this coin is a 50x",
      "which launchpad pumps MET the hardest after every DBC launch",
      "chart looking filthy meteora season points farming ser",
      "just ape every DBC launch for a quick flip not building anything",
      "ETH gas too high rotating into sol memes no launchpad work",
      "$PERPSPAD near trendline support, load up before the bounce",
      "CA: AbcDef123... view full analysis, still early on this pad token",
      "$BAGS breaking out, 100x gem alert, chart attached",
      "LP army assemble we farming locked LP fees tonight",
      "LParmy hold the line MET LP rewards dumping into the vault",
      "join the LP army dump SOL into Meteora pools for yield",
      "Our hackathon project's demo day is Friday looking for teammates",
      "Won the ETHGlobal hackathon shipping an NFT mint, no Solana",
      "Colosseum team forming before the deadline we need a designer",
      "AI Signal (SOL) $JOBLESS CA: 88E4cWZvAvab1gDbjEhVEAbf43h1UgPngdqpUt3D9VrR",
      "Still 20 days left for the $DBC trading contest",
    ],
  },
];

export const BUCKET_BY_ID: Record<BucketId, Bucket> = Object.fromEntries(
  BUCKETS.map((b) => [b.id, b]),
) as Record<BucketId, Bucket>;

/**
 * Public ecosystem lane: pad/builder/drama only.
 * Memes, LP-alpha farming, ticker “want a pad”, and trading-infra bots stay out.
 */
export const ECOSYSTEM_FEED_BUCKETS: ReadonlySet<BucketId> = new Set([
  "builder_integrating_sdk",
  "scaffold_forker",
  "pad_migrating_or_exploring",
  "vertical_quote_meta",
  "pad_live_on_dbc",
  "pad_ecosystem_drama",
  "hackathon_builder",
  "ecosystem_integration",
]);

/** Ranked above drama/competitor once pad accounts are pulled to the top. */
export const DBC_BUILDER_BUCKETS: ReadonlySet<BucketId> = new Set([
  "builder_integrating_sdk",
  "scaffold_forker",
  "pad_migrating_or_exploring",
  "vertical_quote_meta",
  "pad_live_on_dbc",
  "hackathon_builder",
  "ecosystem_integration",
]);

/** Minimum cosine to a *builder/pad* prototype before we trust a content bucket. */
export const SIGNAL_FLOOR = 0.62;

/** @deprecated use SIGNAL_FLOOR — kept so older imports keep compiling */
export const PRIMARY_SCORE_FLOOR = SIGNAL_FLOOR;

/** Secondary labels if within this margin of the primary score */
export const SECONDARY_MARGIN = 0.04;

/**
 * Stage-1 gate: if noiseScore >= signalScore + this, suppress as hype.
 * 0 = noise wins ties. Negative would prefer builder on ties.
 */
export const NOISE_GATE_MARGIN = 0;
