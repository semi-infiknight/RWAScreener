import { LIST_FEED_HANDLES } from "./ecosystem-anchor.js";
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
