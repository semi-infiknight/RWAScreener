import { classifyPost, warmupClassifier } from "./classifier.js";
import { hasEcosystemAnchor } from "./ecosystem-anchor.js";
import {
  exportRealSeed,
  loadMentions,
  upsertMentions,
  type MentionRecord,
} from "./store.js";

/**
 * Re-run the current taxonomy over stored records (local model, no X API
 * cost). Use after bucket/prototype changes so old rows match new buckets.
 *
 * Local store (default, also refreshes the seed snapshot):
 *   npm run reclassify
 * Live site (export → reclassify → upsert back):
 *   npm run reclassify -- --remote=https://web-production-a5814.up.railway.app
 * Requires INGEST_TOKEN for --remote.
 */

const REMOTE = process.argv
  .find((a) => a.startsWith("--remote="))
  ?.split("=")[1]
  ?.replace(/\/$/, "");
const DRY = process.argv.includes("--dry");

async function fetchRemote(base: string): Promise<MentionRecord[]> {
  const token = process.env.INGEST_TOKEN?.trim();
  if (!token) throw new Error("INGEST_TOKEN required for --remote");
  const res = await fetch(`${base}/api/export`, {
    headers: { "x-ingest-token": token },
  });
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as MentionRecord);
}

/** Railway edge can close the keep-alive socket the export reused — retry once per batch. */
async function postBatch(base: string, token: string, records: MentionRecord[]): Promise<number> {
  const body = JSON.stringify({ upsert: true, records });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${base}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ingest-token": token },
        body,
      });
      if (!res.ok) throw new Error(`upsert failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return ((await res.json()) as { saved?: number }).saved ?? 0;
    } catch (err) {
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "UND_ERR_SOCKET" && attempt < 3) continue;
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function pushRemote(base: string, records: MentionRecord[]): Promise<number> {
  const token = process.env.INGEST_TOKEN!.trim();
  let saved = 0;
  for (let i = 0; i < records.length; i += 500) {
    saved += await postBatch(base, token, records.slice(i, i + 500));
  }
  return saved;
}

async function main() {
  const records = REMOTE ? await fetchRemote(REMOTE) : loadMentions();
  console.log(
    `reclassify: ${records.length} records${REMOTE ? ` (remote ${REMOTE})` : " (local)"}`,
  );
  await warmupClassifier();

  const changed: MentionRecord[] = [];
  const moves = new Map<string, number>();
  for (const rec of records) {
    const c = await classifyPost({
      text: rec.text,
      authorName: rec.author?.name,
      authorUsername: rec.author?.username,
      authorBio: rec.author?.bio,
    });
    if (
      !hasEcosystemAnchor(rec.text || "", rec.author?.username) &&
      c.primary !== "official_meteora" &&
      !c.suppressed
    ) {
      c.suppressed = true;
      c.gatedAsNoise = true;
      c.leadScore = 0;
    }
    if (
      c.primary !== rec.classification.primary ||
      c.suppressed !== rec.classification.suppressed
    ) {
      const key = `${rec.classification.primary} → ${c.primary}`;
      moves.set(key, (moves.get(key) ?? 0) + 1);
      changed.push({ ...rec, classification: c });
    }
  }

  console.log(`reclassify: ${changed.length} records change bucket${DRY ? " (dry run)" : ""}`);
  for (const [k, n] of [...moves.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}× ${k}`);
  }
  if (DRY || changed.length === 0) return;

  if (REMOTE) {
    const saved = await pushRemote(REMOTE, changed);
    console.log(`reclassify: pushed ${saved} updated records to ${REMOTE}`);
  } else {
    upsertMentions(changed);
    const n = exportRealSeed();
    console.log(`reclassify: local store updated; seed refreshed (${n} rows)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
