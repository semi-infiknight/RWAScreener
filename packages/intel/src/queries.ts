/**
 * Meteora ecosystem recent-search queries for X API v2.
 * Keep each query under ~512 chars (Basic/Pro recent search limit).
 *
 * Tiers: STRICT builder/BD · SEMANTIC broad nets · OFFICIAL + Vesper
 * footprint · PAD_WATCH (all meteora.fyi screener pads + handles) ·
 * HACKATHON (Meteora track only) · MEMES (Vesper-shaped ecosystem culture).
 *
 * Language-agnostic (no lang:). Classifier is English-only.
 */
const LP_ARMY_NOT = '-("LP army" OR LParmy OR "lp army")';
const DEX_EVENT_NOT = '-url:dexevents.fun -("CHECK EVENTS") -("METEORA_PAIR")';

const STRICT_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "dbc_sdk",
    note: "DBC + SDK/config/partner language",
    query:
      `("Dynamic Bonding Curve" OR DBC) (SDK OR CPI OR config OR partner OR PoolConfig) (Meteora OR @MeteoraAG) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "launchpad_build",
    note: "Launchpads building / integrating",
    query:
      `(launchpad OR "fun launch" OR Invent OR scaffold) (Meteora OR @MeteoraAG) (DBC OR DAMM OR integrate OR building OR shipped) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "damm_migrate",
    note: "DAMM graduation / migration tech",
    query:
      `("DAMM v2" OR DAMMv2 OR DAMM) (migrate OR graduate OR launchpad) (Meteora OR @MeteoraAG OR DBC) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "dlmm_integrate",
    note: "DLMM builder talk",
    query:
      `(DLMM OR "bin step" OR "price bins") (SDK OR CPI OR integrate OR building) (Meteora OR @MeteoraAG) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "docs_sdk_pkg",
    note: "Docs / npm package mentions",
    query:
      '("dynamic-bonding-curve-sdk" OR "@meteora-ag/dynamic-bonding-curve" OR docs.meteora.ag) -is:retweet',
  },
  {
    id: "help_partner",
    note: "Teams wanting help / partnership",
    query:
      `(Meteora OR @MeteoraAG OR DBC) (launchpad) (help OR partner OR integrate OR "looking for" OR "anyone using" OR support) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "builder_shipped",
    note: "Shipped / building signals",
    query:
      `(building OR integrating OR "we shipped" OR "built on" OR "just shipped") (Meteora) (launchpad OR DBC OR DLMM OR DAMM OR SDK) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "vertical_quote",
    note: "Token-2022 / RWA / quote verticals",
    query:
      `("Token-2022" OR "transfer hook" OR RWA OR xStocks OR "quote mint") (Meteora OR DBC OR "bonding curve") -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
];

const SEMANTIC_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "semantic_meteora",
    note: "Meteora + launchpad/DBC/DAMM (no LP army)",
    query:
      `(Meteora OR @MeteoraAG OR @MeteoraEco) (DBC OR "bonding curve" OR DAMM OR DLMM OR launchpad OR Invent OR graduation) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "semantic_dbc_damm",
    note: "DBC / DAMM / DLMM on Solana",
    query:
      `("Dynamic Bonding Curve" OR DBC OR "DAMM v2" OR DAMMv2 OR DLMM OR "dynamic-bonding-curve") (Solana OR $SOL OR @MeteoraAG OR @MeteoraEco) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "semantic_meteora_url",
    note: "Links to meteora.ag / Invent / meteora.fyi",
    query:
      `(url:meteora.ag OR "Meteora Invent" OR (Invent Meteora) OR meteora.fyi) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
];

const OFFICIAL_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "official",
    note: "Official Meteora accounts",
    query: "(from:MeteoraAG OR from:MeteoraEco) -is:retweet",
  },
  {
    id: "vesper_footprint",
    note: "Ecosystem lead @vesper792 feed + replies/mentions (culture + BD gold)",
    query: "(from:vesper792 OR to:vesper792 OR @vesper792) -is:retweet",
  },
];

const PAD_WATCH_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "pad_watch_a",
    note: "Ember Curve · LFOwn · Bags (+ X handles)",
    query:
      '("Ember Curve" OR embercurve.fun OR from:embercurve OR from:embercurvefun OR @embercurve OR LFOwn OR letsfuckingown.fun OR from:LFOWNDOTFUN OR bags.fm OR from:BagsApp OR @BagsApp) -is:retweet',
  },
  {
    id: "pad_watch_b",
    note: "Perpspad · ClawPump · StonkOptions / star.fun (not LaunchOnSF / StonkFun)",
    query:
      "(Perpspad OR perpspad.fun OR from:perpspadfun OR ClawPump OR clawpump.tech OR from:clawpumptech OR StonkOptions OR star.fun OR from:getstonkoptions OR from:stardotfun) -is:retweet",
  },
  {
    id: "pad_watch_c",
    note: "Ethics · RevShare · OTC Desks",
    query:
      '(ethics.ltd OR from:ethicslaunch OR "Ethics launchpad" OR revshare.dev OR from:revshare_app OR otcdesks.cash OR from:otc_labs OR "OTC Desks") -is:retweet',
  },
];

const HACKATHON_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "hackathon_meteora",
    note: "Hackathon / bounty only when Meteora DBC/DAMM/DLMM is the build",
    query:
      `(hackathon OR bounty OR "demo day" OR Colosseum OR Superteam) (Meteora OR @MeteoraAG OR DBC OR DAMM OR DLMM) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
  {
    id: "stocklana_dbc",
    note: "Stocklana + DBC/stock-quote launchpads (ChainRot-class builder updates)",
    query:
      `(Stocklana OR stocklana OR from:ChainRot_app OR from:StockLaunchDBC_ OR from:NousPad OR from:EmojiFunDotXyz) (Meteora OR @MeteoraAG OR @MeteoraEco OR DBC OR "bonding curve" OR launchpad) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
];

const MEME_QUERIES: { id: string; query: string; note: string }[] = [
  {
    id: "memes_ecosystem",
    note: "Vesper-shaped culture: permissionless DBC, builders-win, gud fee tek",
    query:
      `(Meteora OR DBC OR @MeteoraAG OR @vesper792) ("gud fee" OR "builders will win" OR gladiators OR permissionless OR "if it's on solana" OR meme OR shitpost) -is:retweet ${LP_ARMY_NOT} ${DEX_EVENT_NOT}`,
  },
];

export const SEARCH_QUERIES: { id: string; query: string; note: string }[] = [
  ...STRICT_QUERIES,
  ...SEMANTIC_QUERIES,
  ...OFFICIAL_QUERIES,
  ...PAD_WATCH_QUERIES,
  ...HACKATHON_QUERIES,
  // ...MEME_QUERIES — ticker/culture shitposts drowned the builder feed
];

export const BACKFILL_QUERIES: { id: string; query: string; note: string }[] =
  SEARCH_QUERIES;
