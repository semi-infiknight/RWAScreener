import { X_API_BASE, requireBearerToken } from "./config.js";

export type XUser = {
  id: string;
  name?: string;
  username?: string;
  description?: string;
  profile_image_url?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
};

export type XMedia = {
  media_key: string;
  type: string; // photo | video | animated_gif
  url?: string; // photos
  preview_image_url?: string; // video/gif poster
  width?: number;
  height?: number;
};

export type XPost = {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  in_reply_to_user_id?: string;
  lang?: string;
  entities?: {
    mentions?: { username?: string; id?: string }[];
  };
  attachments?: { media_keys?: string[] };
  referenced_tweets?: { type: string; id: string }[];
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    impression_count?: number;
  };
};

export type SearchedPost = {
  post: XPost;
  author?: XUser;
  media?: XMedia[];
  isQuote?: boolean;
  isReply?: boolean;
  /** Who this reply is to (expanded in_reply_to_user_id). */
  repliedTo?: XUser;
  /** Authors of quoted posts (expanded referenced_tweets). */
  quotedAuthors?: XUser[];
  queryId: string;
};

type SearchResponse = {
  data?: XPost[];
  includes?: { users?: XUser[]; media?: XMedia[]; tweets?: XPost[] };
  meta?: { next_token?: string; result_count?: number; newest_id?: string };
  errors?: unknown[];
  title?: string;
  detail?: string;
  status?: number;
};

export class XSearchError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`X search failed (${status}): ${detail}`);
    this.name = "XSearchError";
    this.status = status;
    this.detail = detail;
  }

  /** True when offline/demo path should be preferred */
  get isCreditsOrAuth(): boolean {
    return this.status === 401 || this.status === 402 || this.status === 403;
  }

  get offlineHint(): string | undefined {
    if (!this.isCreditsOrAuth) return undefined;
    if (this.status === 402) {
      return "X API credits depleted. Offline path still works: npm run scan -- --demo";
    }
    return "X API auth/permission error. Offline path still works: npm run scan -- --demo";
  }
}

export type SearchOpts = {
  query: string;
  queryId: string;
  maxResults?: number;
  nextToken?: string;
  /** RFC3339. Used by recent (within 7d) and archive. */
  startTime?: string;
  endTime?: string;
  /** GET /2/tweets/search/all — needs archive access */
  archive?: boolean;
};

const TWEET_FIELDS =
  "created_at,public_metrics,author_id,lang,conversation_id,in_reply_to_user_id,entities,attachments,referenced_tweets";
const EXPANSIONS =
  "author_id,in_reply_to_user_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id";
const USER_FIELDS = "username,name,description,public_metrics,verified,profile_image_url";
const MEDIA_FIELDS = "url,preview_image_url,type,width,height";

export function postsFromXResponse(
  body: SearchResponse,
  queryId: string,
): SearchedPost[] {
  const users = new Map(
    (body.includes?.users ?? []).map((u) => [u.id, u] as const),
  );
  const mediaByKey = new Map(
    (body.includes?.media ?? []).map((m) => [m.media_key, m] as const),
  );
  const refTweets = new Map(
    (body.includes?.tweets ?? []).map((t) => [t.id, t] as const),
  );
  return (body.data ?? []).map((post) => {
    const keys = post.attachments?.media_keys ?? [];
    const media = keys
      .map((k) => mediaByKey.get(k))
      .filter((m): m is XMedia => Boolean(m));
    const quotedAuthors: XUser[] = [];
    for (const ref of post.referenced_tweets ?? []) {
      if (ref.type !== "quoted") continue;
      const quoted = refTweets.get(ref.id);
      const author = quoted?.author_id ? users.get(quoted.author_id) : undefined;
      if (author) quotedAuthors.push(author);
    }
    const repliedTo = post.in_reply_to_user_id
      ? users.get(post.in_reply_to_user_id)
      : undefined;
    return {
      post,
      author: post.author_id ? users.get(post.author_id) : undefined,
      media: media.length ? media : undefined,
      isQuote: post.referenced_tweets?.some((r) => r.type === "quoted") || undefined,
      isReply: post.referenced_tweets?.some((r) => r.type === "replied_to")
        ? true
        : undefined,
      repliedTo,
      quotedAuthors: quotedAuthors.length ? quotedAuthors : undefined,
      queryId,
    };
  });
}

export async function searchX(opts: SearchOpts): Promise<{
  posts: SearchedPost[];
  nextToken?: string;
  resultCount: number;
}> {
  const bearer = requireBearerToken();
  const params = new URLSearchParams({
    query: opts.query,
    max_results: String(Math.min(100, Math.max(10, opts.maxResults ?? 25))),
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
  });
  if (opts.nextToken) params.set("next_token", opts.nextToken);
  if (opts.startTime) {
    let start = opts.startTime;
    if (!opts.archive) {
      const floor = Date.now() - 7 * 24 * 60 * 60 * 1000 + 120_000;
      const t = new Date(start).getTime();
      if (Number.isFinite(t) && t < floor) start = new Date(floor).toISOString();
    }
    params.set("start_time", start);
  }
  if (opts.endTime) params.set("end_time", opts.endTime);

  const path = opts.archive ? "/tweets/search/all" : "/tweets/search/recent";
  const url = `${X_API_BASE}${path}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  let body: SearchResponse;
  try {
    body = (await res.json()) as SearchResponse;
  } catch {
    throw new XSearchError(res.status, res.statusText || "invalid JSON response");
  }

  if (!res.ok) {
    const detail =
      body.detail ||
      body.title ||
      JSON.stringify(body).slice(0, 400) ||
      res.statusText;
    throw new XSearchError(res.status, detail);
  }

  const posts = postsFromXResponse(body, opts.queryId);

  return {
    posts,
    nextToken: body.meta?.next_token,
    resultCount: body.meta?.result_count ?? posts.length,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Walk next_token until exhausted or maxPages. */
export async function searchXPages(
  opts: SearchOpts & { maxPages?: number },
): Promise<{ posts: SearchedPost[]; pages: number; archive: boolean }> {
  const maxPages = Math.max(1, opts.maxPages ?? 1);
  const all: SearchedPost[] = [];
  let token: string | undefined;
  let pages = 0;
  let archive = Boolean(opts.archive);

  for (let i = 0; i < maxPages; i++) {
    try {
      const page = await searchX({
        ...opts,
        archive,
        nextToken: token,
      });
      pages++;
      all.push(...page.posts);
      token = page.nextToken;
      if (!token) break;
      await sleep(350);
    } catch (err) {
      if (
        archive &&
        err instanceof XSearchError &&
        (err.status === 403 || err.status === 400)
      ) {
        console.log(
          `    archive unavailable (${err.status}); falling back to 7-day recent search`,
        );
        archive = false;
        token = undefined;
        i--;
        continue;
      }
      throw err;
    }
  }

  return { posts: all, pages, archive };
}

/** GET /2/tweets?ids= — missing IDs are deleted, withheld, or never existed. */
export async function lookupTweetPresence(ids: string[]): Promise<{
  found: Set<string>;
  missing: string[];
}> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return { found: new Set(), missing: [] };
  const bearer = requireBearerToken();
  const params = new URLSearchParams({
    ids: unique.join(","),
    "tweet.fields": "id",
  });
  const res = await fetch(`${X_API_BASE}/tweets?${params.toString()}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  let body: { data?: { id: string }[]; title?: string; detail?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new XSearchError(res.status, res.statusText || "invalid JSON response");
  }
  if (!res.ok) {
    throw new XSearchError(
      res.status,
      body.detail || body.title || res.statusText,
    );
  }
  const found = new Set((body.data ?? []).map((p) => p.id));
  return { found, missing: unique.filter((id) => !found.has(id)) };
}

/** GET /2/tweets?ids= with author/media expansions (ingest a known post). */
export async function fetchTweetsByIds(
  ids: string[],
  queryId = "id_lookup",
): Promise<SearchedPost[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (unique.length === 0) return [];
  const params = new URLSearchParams({
    ids: unique.join(","),
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
  });
  const body = await xGet(`/tweets?${params.toString()}`);
  return postsFromXResponse(body, queryId);
}

function clampRecentStart(start: string): string {
  const floor = Date.now() - 7 * 24 * 60 * 60 * 1000 + 120_000;
  const t = new Date(start).getTime();
  if (Number.isFinite(t) && t < floor) return new Date(floor).toISOString();
  return start;
}

async function xGet(pathAndQuery: string): Promise<SearchResponse> {
  const bearer = requireBearerToken();
  const res = await fetch(`${X_API_BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  let body: SearchResponse;
  try {
    body = (await res.json()) as SearchResponse;
  } catch {
    throw new XSearchError(res.status, res.statusText || "invalid JSON response");
  }
  if (!res.ok) {
    throw new XSearchError(
      res.status,
      body.detail || body.title || res.statusText,
    );
  }
  return body;
}

export async function lookupUsersByUsernames(
  usernames: string[],
): Promise<Map<string, XUser>> {
  const unique = [
    ...new Set(
      usernames.map((u) => u.replace(/^@/, "").trim().toLowerCase()).filter(Boolean),
    ),
  ].slice(0, 100);
  const out = new Map<string, XUser>();
  if (unique.length === 0) return out;
  const params = new URLSearchParams({
    usernames: unique.join(","),
    "user.fields": USER_FIELDS,
  });
  const body = await xGet(`/users/by?${params.toString()}`);
  for (const user of body.includes?.users ?? []) {
    if (user.username) out.set(user.username.toLowerCase(), user);
  }
  // /users/by returns users in `data`, not includes
  const dataUsers = (body as SearchResponse & { data?: XUser[] }).data;
  if (Array.isArray(dataUsers)) {
    for (const user of dataUsers) {
      if (user.username) out.set(user.username.toLowerCase(), user);
    }
  }
  return out;
}

function timelineParams(startTime: string | undefined, maxResults: number): URLSearchParams {
  const params = new URLSearchParams({
    max_results: String(Math.min(100, Math.max(5, maxResults))),
    exclude: "retweets",
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
  });
  if (startTime) params.set("start_time", clampRecentStart(startTime));
  return params;
}

/** GET /2/users/:id/tweets — that account’s posts (X profile timeline). */
export async function fetchUserTweets(opts: {
  userId: string;
  queryId: string;
  startTime?: string;
  maxResults?: number;
}): Promise<SearchedPost[]> {
  const params = timelineParams(opts.startTime, opts.maxResults ?? 10);
  const body = await xGet(`/users/${opts.userId}/tweets?${params.toString()}`);
  return postsFromXResponse(body, opts.queryId);
}

/** GET /2/users/:id/mentions — posts that mention / reply to them. */
export async function fetchUserMentions(opts: {
  userId: string;
  queryId: string;
  startTime?: string;
  maxResults?: number;
}): Promise<SearchedPost[]> {
  const params = timelineParams(opts.startTime, opts.maxResults ?? 10);
  params.delete("exclude");
  const body = await xGet(`/users/${opts.userId}/mentions?${params.toString()}`);
  return postsFromXResponse(body, opts.queryId);
}
