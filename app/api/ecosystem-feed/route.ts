import { NextResponse } from "next/server";

/**
 * Proxy + cache for the Meteora Intel ecosystem feed.
 * Paginates (24/page) so the homepage does not download the full store.
 * No CDN/memory cache — spam filters + native cards must show immediately.
 */

export const dynamic = "force-dynamic";

type FeedPost = {
  id: string;
  text: string;
  createdAt?: string;
  url: string;
  author?: {
    username?: string;
    name?: string;
    avatarUrl?: string;
    verified?: boolean;
  };
  media?: { type: string; url: string }[];
  metrics?: {
    likes?: number;
    replies?: number;
    reposts?: number;
    impressions?: number;
  };
  classification: {
    primary: string;
    leadScore?: number;
    suppressed?: boolean;
  };
  isQuote?: boolean;
  isReply?: boolean;
};

type FeedResponse = {
  window: string;
  lane: string;
  postType: string;
  count: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  posts: FeedPost[];
};

// const CACHE_TTL_MS = 20 * 1000;
// const cache = new Map<string, { data: FeedResponse; at: number }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lane = url.searchParams.get("lane") || "ecosystem";
  const window = url.searchParams.get("window") || "all";
  const postType = url.searchParams.get("type") || "posts";
  const bucket = url.searchParams.get("bucket") || "";
  const page = url.searchParams.get("page") || "1";
  const limit = url.searchParams.get("limit") || "24";

  const baseUrl = process.env.METEORA_INTEL_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { count: 0, posts: [], hasMore: false, error: "METEORA_INTEL_URL not set" },
      { status: 200 },
    );
  }

  const params = new URLSearchParams({
    lane,
    window,
    type: postType,
    page,
    limit,
  });
  if (bucket) params.set("bucket", bucket);

  try {
    const res = await fetch(`${baseUrl}/api/feed?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { count: 0, posts: [], hasMore: false, error: `upstream ${res.status}` },
        { status: 200 },
      );
    }
    const data = (await res.json()) as FeedResponse;
    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { count: 0, posts: [], hasMore: false, error: String(err) },
      { status: 200 },
    );
  }
}
