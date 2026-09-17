import { searchXPages, lookupUsersByUsernames, fetchUserTweets } from "../src/x-client.js";

const q =
  '(Stocklana OR stocklana OR from:ChainRot_app OR from:StockLaunchDBC_ OR from:NousPad) (Meteora OR @MeteoraAG OR @MeteoraEco OR DBC OR "bonding curve" OR launchpad) -is:retweet';

async function main() {
  const { posts } = await searchXPages({
    query: q,
    queryId: "stocklana_dbc",
    maxResults: 25,
    maxPages: 1,
  });
  const by = new Map<string, { id: string; text: string }[]>();
  for (const p of posts) {
    const u = p.author?.username || "?";
    const list = by.get(u) ?? [];
    list.push({ id: p.post.id, text: p.post.text.slice(0, 90).replace(/\n/g, " ") });
    by.set(u, list);
  }
  console.log("search_hits", posts.length);
  for (const [u, items] of by) {
    console.log(`@${u} x${items.length}`);
    for (const it of items.slice(0, 2)) console.log(" ", it.id, it.text);
  }

  const users = await lookupUsersByUsernames([
    "chainrot_app",
    "nouspad",
    "stocklaunchdbc_",
  ]);
  console.log("resolved", [...users.keys()].join(", ") || "(none)");
  const startTime = new Date(Date.now() - 7 * 864e5).toISOString();
  for (const [h, u] of users) {
    const tl = await fetchUserTweets({
      userId: u.id,
      queryId: `tl_${h}`,
      maxResults: 10,
      startTime,
    });
    const originals = tl.filter((p) => !p.isReply);
    console.log("timeline", h, "all", tl.length, "posts", originals.length);
    for (const p of originals.slice(0, 4)) {
      console.log(" ", p.post.id, p.post.text.slice(0, 90).replace(/\n/g, " "));
    }
  }
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
