import { LIST_FEED_HANDLES } from "./ecosystem-anchor.js";
import {
  harvestTargetsFromInterest,
  interestFromVesperPosts,
  persistVesperInterest,
} from "./vesper-interest.js";
import {
  fetchUserMentions,
  fetchUserTweets,
  lookupUsersByUsernames,
  XSearchError,
  type SearchedPost,
} from "./x-client.js";

/**
 * X List / Following-column harvest: resolve seed handles, pull each
 * profile timeline + mentions, merge. Search stays for unknown builders.
 */
export async function harvestListFeed(opts: {
  tweetStartTime: string;
  mentionStartTime: string;
  maxTweets?: number;
  maxMentions?: number;
}): Promise<SearchedPost[]> {
  const maxTweets = opts.maxTweets ?? 25;
  const maxMentions = opts.maxMentions ?? 10;
  const users = await lookupUsersByUsernames(LIST_FEED_HANDLES);
  console.log(`list-feed: resolved ${users.size}/${LIST_FEED_HANDLES.length} accounts`);
  const out: SearchedPost[] = [];

  for (const handle of LIST_FEED_HANDLES) {
    const user = users.get(handle.toLowerCase());
    if (!user) {
      console.log(`  [list @${handle}] skip — username not resolved`);
      continue;
    }
    try {
      const tweets = await fetchUserTweets({
        userId: user.id,
        queryId: `tl_${handle}`,
        startTime: opts.tweetStartTime,
        maxResults: maxTweets,
      });
      const mentions = await fetchUserMentions({
        userId: user.id,
        queryId: `men_${handle}`,
        startTime: opts.mentionStartTime,
        maxResults: maxMentions,
      });
      console.log(`  [list @${handle}] tweets=${tweets.length} mentions=${mentions.length}`);
      out.push(...tweets, ...mentions);
    } catch (err) {
      if (err instanceof XSearchError && err.status === 402) {
        console.error(`  [list @${handle}] 402 credits depleted — stopping list harvest`);
        break;
      }
      console.error(`  [list @${handle}] ${String(err)}`);
    }
  }

  return out;
}

/** After reading Vesper's timeline, pull accounts she quoted or replied to. */
export async function harvestVesperInterestTargets(
  vesperPosts: SearchedPost[],
  opts: { tweetStartTime: string; maxTweets?: number; cap?: number },
): Promise<SearchedPost[]> {
  const hits = interestFromVesperPosts(vesperPosts);
  persistVesperInterest(hits);
  const targets = harvestTargetsFromInterest(hits, opts.cap ?? 12);
  console.log(
    `vesper-interest: ${hits.length} handles, harvesting ${targets.length}: ${targets.join(", ") || "(none)"}`,
  );
  if (targets.length === 0) return [];
  const users = await lookupUsersByUsernames(targets);
  const maxTweets = opts.maxTweets ?? 15;
  const out: SearchedPost[] = [];
  for (const handle of targets) {
    const user = users.get(handle.toLowerCase());
    if (!user) {
      console.log(`  [vesper-int @${handle}] skip — not resolved`);
      continue;
    }
    try {
      const tweets = await fetchUserTweets({
        userId: user.id,
        queryId: `vesper_int_${handle}`,
        startTime: opts.tweetStartTime,
        maxResults: maxTweets,
      });
      console.log(`  [vesper-int @${handle}] tweets=${tweets.length}`);
      out.push(...tweets);
    } catch (err) {
      if (err instanceof XSearchError && err.status === 402) {
        console.error(`  [vesper-int @${handle}] 402 — stopping interest harvest`);
        break;
      }
      console.error(`  [vesper-int @${handle}] ${String(err)}`);
    }
  }
  return out;
}
