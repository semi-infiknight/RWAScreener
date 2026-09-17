import { BUCKET_BY_ID } from "./buckets.js";
import {
  loadMentions,
  summarizeByBucket,
  topLeads,
  type MentionRecord,
} from "./store.js";

function shortText(text: string, n = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function printBucketReport(mentions = loadMentions()) {
  console.log(`\nMeteora intel — ${mentions.length} classified mentions\n`);
  if (mentions.length === 0) {
    console.log("No data yet. Run: npm run scan");
    return;
  }

  const summaries = summarizeByBucket(mentions, 3);
  for (const s of summaries) {
    const meta = BUCKET_BY_ID[s.bucket];
    console.log(
      `▸ ${meta.label} [${s.bucket}] — ${s.count} posts (avg lead ${s.avgLeadScore})`,
    );
    for (const m of s.top) {
      const who = m.author?.username ? `@${m.author.username}` : "unknown";
      console.log(
        `   · ${who} lead=${m.classification.leadScore.toFixed(3)} | ${shortText(m.text)}`,
      );
      console.log(`     ${m.url}`);
    }
    console.log("");
  }
}

export function printLeads(mentions = loadMentions(), limit = 20) {
  const leads = topLeads(mentions, limit);
  console.log(`\nTop ${leads.length} launchpad / builder leads\n`);
  if (leads.length === 0) {
    console.log("No leads yet. Run a scan first.");
    return;
  }

  leads.forEach((m, i) => {
    const who = m.author?.username ? `@${m.author.username}` : "unknown";
    const followers = m.author?.followers;
    const bucket = BUCKET_BY_ID[m.classification.primary].label;
    console.log(
      `${i + 1}. ${who}${followers != null ? ` (${followers} followers)` : ""}`,
    );
    console.log(
      `   bucket=${bucket}  lead=${m.classification.leadScore.toFixed(3)}  conf=${m.classification.primaryScore.toFixed(3)}`,
    );
    if (m.classification.secondary.length) {
      console.log(
        `   also: ${m.classification.secondary.map((s) => s.id).join(", ")}`,
      );
    }
    console.log(`   ${shortText(m.text, 200)}`);
    console.log(`   ${m.url}\n`);
  });
}

export function mentionToCrmRow(m: MentionRecord) {
  return {
    handle: m.author?.username ?? "",
    name: m.author?.name ?? "",
    followers: m.author?.followers ?? 0,
    bucket: m.classification.primary,
    leadScore: m.classification.leadScore,
    url: m.url,
    text: m.text,
    scannedAt: m.scannedAt,
  };
}
