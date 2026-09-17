#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { BACKFILL_QUERIES, SEARCH_QUERIES } from "./queries.js";
import { searchXPages, XSearchError } from "./x-client.js";
import {
  buildClassificationDocument,
  classifyText,
  warmupClassifier,
} from "./classifier.js";
import {
  exportRealSeed,
  knownMentionIds,
  mentionUrl,
  saveMention,
  saveRun,
  upsertMentions,
  type MentionRecord,
} from "./store.js";
import { recordFromRaw } from "./ingest.js";
import { printBucketReport, printLeads } from "./report.js";
import { BUCKETS } from "./buckets.js";
import { DEFAULT_MAX_RESULTS } from "./config.js";
import { DEMO_POSTS } from "./fixtures.js";

function usage() {
  console.log(`meteora-intel — Meteora / DBC builder & launchpad mention tracker

Usage:
  npm run scan -- [--max=100] [--query=dbc_sdk] [--demo] [--force]
  npm run scan -- --backfill [--since=2025-01-01] [--pages=5] [--archive]
  npm run report
  npm run leads -- [--limit=20]
  npm run classify-demo
  npm run site
  npm test

Flags:
  --demo       Synthetic fixtures (local tests only; not the live site seed)
  --force      With --demo, rewrite demo-* rows
  --backfill   Paginate search; try full-archive then 7-day recent
  --archive    Prefer GET /2/tweets/search/all (falls back if 403)
  --since=ISO  start_time (default for backfill: 2025-01-01)
  --pages=N    Pages per query (default 1, backfill default 4)
  --max=N      Results per page (10–100)
  --query=id   Single query id
  --seed       After scan, write fixtures/seed-mentions.jsonl (real posts only)

Env (repo root .env):
  X_BEARER_TOKEN          required for live X search
  METEORA_INTEL_DATA_DIR  optional override for JSONL storage
`);
}

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | boolean>();
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    flags.set(k, v === undefined ? true : v);
  }
  return flags;
}

async function cmdClassifyDemo() {
  console.log("Warming local BGE-small classifier (first run downloads model)…");
  await warmupClassifier();
  console.log(`Loaded ${BUCKETS.length} bucket embeddings.\n`);

  for (const demo of DEMO_POSTS) {
    const doc = buildClassificationDocument({
      text: demo.text,
      authorUsername: demo.authorUsername,
      authorBio: demo.authorBio,
    });
    const c = await classifyText(doc);
    console.log(`@${demo.authorUsername}`);
    console.log(`  ${demo.text}`);
    console.log(
      `  → ${c.primary} (${c.primaryScore.toFixed(3)}) lead=${c.leadScore} suppressed=${c.suppressed}`,
    );
    if (c.secondary.length) {
      console.log(
        `    secondary: ${c.secondary.map((s) => `${s.id}:${s.score.toFixed(3)}`).join(", ")}`,
      );
    }
    console.log("");
  }
}

async function runDemoScan(force: boolean) {
  console.log("Demo scan (no X API) — classifying synthetic posts…");
  await warmupClassifier();
  const known = knownMentionIds();
  const records: MentionRecord[] = [];

  for (const demoPost of DEMO_POSTS) {
    if (!force && known.has(demoPost.id)) {
      console.log(`skip ${demoPost.id} (already saved; pass --force to rewrite)`);
      continue;
    }
    const classification = await classifyText(
      buildClassificationDocument({
        text: demoPost.text,
        authorUsername: demoPost.authorUsername,
        authorBio: demoPost.authorBio,
      }),
    );
    records.push({
      id: demoPost.id,
      text: demoPost.text,
      createdAt: new Date().toISOString(),
      url: mentionUrl(demoPost.authorUsername, demoPost.id),
      queryId: "demo",
      author: {
        id: demoPost.id,
        username: demoPost.authorUsername,
        bio: demoPost.authorBio,
      },
      classification,
      scannedAt: new Date().toISOString(),
    });
    console.log(
      `classified ${demoPost.id} → ${classification.primary} lead=${classification.leadScore}`,
    );
  }

  if (records.length === 0) {
    console.log("Demo done. Saved 0 new rows.");
    return;
  }

  if (force) {
    upsertMentions(records);
  } else {
    for (const record of records) saveMention(record);
  }
  console.log(`Demo done. Saved ${records.length} rows.`);
}

function toStartTime(since: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(since)) return `${since}T00:00:00.000Z`;
  return since;
}

async function cmdScan(flags: Map<string, string | boolean>) {
  const demo = Boolean(flags.get("demo"));
  const force = Boolean(flags.get("force"));
  const backfill = Boolean(flags.get("backfill"));
  const wantArchive = backfill || Boolean(flags.get("archive"));
  const maxResults = Number(
    flags.get("max") ?? (backfill ? 100 : DEFAULT_MAX_RESULTS),
  );
  const maxPages = Number(flags.get("pages") ?? (backfill ? 4 : 1));
  const sinceRaw = String(flags.get("since") ?? (backfill ? "2025-01-01" : ""));
  const startTime = sinceRaw ? toStartTime(sinceRaw) : undefined;
  const writeSeed = backfill || Boolean(flags.get("seed"));
  const onlyQuery = flags.get("query");
  const pool = backfill ? BACKFILL_QUERIES : SEARCH_QUERIES;
  const queries = pool.filter((q) =>
    typeof onlyQuery === "string" ? q.id === onlyQuery : true,
  );

  if (demo) {
    await runDemoScan(force);
    return;
  }

  if (queries.length === 0) {
    console.error(`No queries matched --query=${String(onlyQuery)}`);
    process.exitCode = 1;
    return;
  }

  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const hints = new Set<string>();
  let fetched = 0;
  let classified = 0;
  let newSaved = 0;
  const known = knownMentionIds();

  console.log("Warming local BGE-small classifier…");
  await warmupClassifier();
  console.log(
    `Scanning ${queries.length} queries (max ${maxResults}/page, pages=${maxPages}${wantArchive ? ", archive-first" : ""}${startTime ? `, since ${startTime}` : ""})…`,
  );

  for (const q of queries) {
    process.stdout.write(`  [${q.id}] `);
    try {
      const { posts, pages, archive } = await searchXPages({
        query: q.query,
        queryId: q.id,
        maxResults,
        maxPages,
        archive: wantArchive,
        startTime,
      });
      fetched += posts.length;
      console.log(
        `${posts.length} posts (${pages} page${pages === 1 ? "" : "s"}, ${archive ? "archive" : "recent"})`,
      );

      for (const item of posts) {
        if (known.has(item.post.id)) continue;
        const record = await recordFromRaw({ ...item, queryId: q.id });
        classified++;
        saveMention(record);
        known.add(item.post.id);
        newSaved++;
        const classification = record.classification;
        const mark = classification.suppressed ? "·" : "★";
        console.log(
          `    ${mark} @${item.author?.username ?? "?"} → ${classification.primary} (${classification.leadScore})`,
        );
      }
    } catch (err) {
      if (err instanceof XSearchError) {
        errors.push(`${q.id}: ${err.message}`);
        console.log(`ERROR ${err.message}`);
        if (err.offlineHint) hints.add(err.offlineHint);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${q.id}: ${msg}`);
        console.log(`ERROR ${msg}`);
      }
    }
  }

  saveRun({
    id: randomUUID(),
    startedAt,
    finishedAt: new Date().toISOString(),
    queries: queries.map((q) => q.id),
    fetched,
    classified,
    newSaved,
    errors,
  });

  console.log(
    `\nDone. fetched=${fetched} classified=${classified} new=${newSaved} errors=${errors.length}`,
  );
  if (errors.length) {
    console.log("Errors:");
    for (const e of errors) console.log(`  - ${e}`);
  }
  for (const hint of hints) {
    console.log(`Hint: ${hint}`);
  }
  if (writeSeed) {
    const n = exportRealSeed();
    console.log(`Wrote fixtures/seed-mentions.jsonl (${n} real posts, demo-* omitted)`);
  }

  // Live scan with only API failures still exits 0 so offline workflows stay usable;
  // mark non-zero only when every query failed and nothing was saved.
  if (errors.length === queries.length && newSaved === 0) {
    process.exitCode = 2;
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);

  switch (cmd) {
    case "scan":
      await cmdScan(flags);
      break;
    case "report":
      printBucketReport();
      break;
    case "leads":
      printLeads(undefined, Number(flags.get("limit") ?? 20));
      break;
    case "classify-demo":
      await cmdClassifyDemo();
      break;
    case "site": {
      const { startSiteServer } = await import("./site-server.js");
      startSiteServer();
      break;
    }
    case "help":
    case undefined:
      usage();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
