"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Meteora ecosystem feed — classified posts from meteora-intel as native
 * cards (not Tweet.html iframes — those stall scroll).
 */

type Post = {
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
  classification: { primary: string; leadScore: number; suppressed: boolean };
  isQuote?: boolean;
  isReply?: boolean;
};

type FeedData = {
  posts: Post[];
  hasMore?: boolean;
  error?: string;
};

const PAGE = 24;

/**
 * Manual masonry columns (CSS multicol reflows the whole container on every
 * infinite-scroll append and defeats content-visibility). Round-robin keeps
 * card i in column i%cols stable across appends, so existing cards never
 * re-layout or re-render when a page lands.
 */
function useColumnCount(): number {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const mq2 = globalThis.matchMedia("(max-width: 900px)");
    const mq1 = globalThis.matchMedia("(max-width: 560px)");
    const update = () => setCols(mq1.matches ? 1 : mq2.matches ? 2 : 3);
    update();
    mq2.addEventListener("change", update);
    mq1.addEventListener("change", update);
    return () => {
      mq2.removeEventListener("change", update);
      mq1.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

// Time windows (All / Today / This week) — hidden for now; API still defaults to all.
// const WINDOWS = [
//   { id: "all", label: "All" },
//   { id: "today", label: "Today" },
//   { id: "week", label: "This week" },
// ] as const;

const ICONS = {
  reply:
    "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z",
  repost:
    "M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V8.38L1.853 9.91.147 8.09l4.603-4.3zm11.5 2.71H11V4h5.25c2.347 0 4.25 1.9 4.25 4.25v7.37l1.647-1.53 1.706 1.82-4.603 4.3-4.603-4.3 1.706-1.82L18 15.62V8.25c0-.97-.784-1.75-1.75-1.75z",
  like: "M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z",
  views:
    "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z",
  verified:
    "M12 1.6l2.2 2.2 3.1-.2.6 3 2.6 1.7-1.3 2.8 1.3 2.8-2.6 1.7-.6 3-3.1-.2L12 24.4 9.8 22.2l-3.1.2-.6-3-2.6-1.7 1.3-2.8-1.3-2.8 2.6-1.7.6-3 3.1.2L12 1.6zm-1 13.9l5-5-1.4-1.4-3.6 3.6-1.6-1.6L7.4 12l3.6 3.5z",
} as const;

function icon(path: string, label: string) {
  return (
    <svg viewBox="0 0 24 24" aria-label={label} className="eco-icon" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

type Lane = "ecosystem" | "official";
type PostType = "posts" | "replies";

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function fmtCount(n?: number): string {
  if (!n || n < 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function EcosystemFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lane, setLane] = useState<Lane>("ecosystem");
  const [postType, setPostType] = useState<PostType>("posts");
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const scrollArmedRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cols = useColumnCount();

  const columns = useMemo(() => {
    const out: Post[][] = Array.from({ length: cols }, () => []);
    for (let i = 0; i < posts.length; i++) out[i % cols]!.push(posts[i]!);
    return out;
  }, [posts, cols]);

  useEffect(() => {
    if (loaded) return;
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      } else {
        setLoading(true);
        loadingMoreRef.current = false;
      }
      const params = new URLSearchParams({
        lane,
        type: postType,
        page: String(nextPage),
        limit: String(PAGE),
        v: "native3",
      });
      try {
        const res = await fetch(`/api/ecosystem-feed?${params}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as FeedData;
        const incoming = data.posts || [];
        setPosts((prev) => {
          if (!append) {
            const same =
              prev.length === incoming.length &&
              prev.every((p, i) => p.id === incoming[i]?.id);
            return same ? prev : incoming;
          }
          const seen = new Set(prev.map((p) => p.id));
          const extra = incoming.filter((p) => !seen.has(p.id));
          return extra.length ? [...prev, ...extra] : prev;
        });
        setHasMore(Boolean(data.hasMore));
        pageRef.current = nextPage;
      } catch {
        if (!append) {
          setPosts([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [lane, postType],
  );

  useEffect(() => {
    if (!loaded) return;
    void fetchPage(1, false);
  }, [loaded, fetchPage]);

  useEffect(() => {
    const onScroll = () => {
      scrollArmedRef.current = true;
    };
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => globalThis.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!loaded || !hasMore || loading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (loadingMoreRef.current) return;
        if (!scrollArmedRef.current) return;
        scrollArmedRef.current = false;
        loadingMoreRef.current = true;
        void fetchPage(pageRef.current + 1, true);
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loaded, hasMore, loading, loadingMore, fetchPage, posts.length]);

  return (
    <section className="eco-feed" ref={sectionRef} aria-label="Meteora Ecosystem feed">
      <header className="eco-feed-lockup">
        <h2 className="hero-title eco-feed-title">
          <span className="hero-title-text">
            <span className="hero-title-brand">Meteora</span>
            <span className="hero-title-light"> Ecosystem feed</span>
          </span>
        </h2>
      </header>
      <div className="eco-feed-bar">
        {loaded && (
          <div className="eco-feed-toggles">
            <div className="eco-tabs" role="tablist" aria-label="Lane">
              {(["ecosystem", "official"] as Lane[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lane === l}
                  className={`eco-tab ${lane === l ? "is-active" : ""}`}
                  onClick={() => setLane(l)}
                >
                  {l === "official" ? "Official" : "Ecosystem"}
                </button>
              ))}
            </div>
            <div className="eco-type-toggle" role="tablist" aria-label="Post type">
              {(["posts", "replies"] as PostType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={postType === t}
                  className={`eco-type-opt ${postType === t ? "is-active" : ""}`}
                  onClick={() => setPostType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Time window tabs (All / Today / This week) — re-enable when needed. */}
          </div>
        )}
      </div>

      {loaded ? (
        loading && posts.length === 0 ? (
          <div className="eco-feed-loading" role="status">
            Loading…
          </div>
        ) : posts.length === 0 ? (
          <div className="eco-feed-empty">
            <p>No posts yet.</p>
          </div>
        ) : (
          <>
            <div className="eco-feed-masonry">
              {columns.map((col, i) => (
                <div className="eco-feed-col" key={i}>
                  {col.map((p) => (
                    <FeedCard key={p.id} post={p} />
                  ))}
                </div>
              ))}
            </div>
            {hasMore ? (
              <div
                ref={sentinelRef}
                className="eco-feed-sentinel"
                aria-hidden="true"
              />
            ) : null}
            {loadingMore ? (
              <div className="eco-feed-loading eco-feed-loading-more" role="status">
                Loading…
              </div>
            ) : null}
          </>
        )
      ) : (
        <div className="eco-feed-placeholder" aria-hidden="true" />
      )}
    </section>
  );
}

const FeedCard = memo(function FeedCard({ post }: { post: Post }) {
  const handle = post.author?.username || "unknown";
  const name = post.author?.name || handle;
  const when = relativeTime(post.createdAt);
  const mx = post.metrics || {};
  const media = (post.media || []).slice(0, 4);

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="eco-card"
      aria-label={`Open post by @${handle} on X`}
    >
      <div className="eco-card-header">
        {post.author?.avatarUrl ? (
          <img
            src={post.author.avatarUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="eco-avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="eco-avatar eco-avatar-letter" aria-hidden="true">
            {handle.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="eco-card-who">
          <span className="eco-card-name">
            {name}
            {post.author?.verified && icon(ICONS.verified, "verified")}
          </span>
          <span className="eco-card-meta">
            @{handle} · {when}
            {post.isQuote ? " · quote" : ""}
          </span>
        </div>
      </div>
      <p className="eco-card-text">{post.text}</p>
      {media.length > 0 && (
        <div className={`eco-media eco-media-${media.length}`}>
          {media.map((m, i) => (
            <img
              key={i}
              src={
                m.url.includes("pbs.twimg.com/media/") && !m.url.includes("name=")
                  ? `${m.url}?name=small`
                  : m.url
              }
              alt=""
              loading="lazy"
              decoding="async"
              className="eco-media-img"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>
      )}
      <div className="eco-card-footer">
        <span className="eco-eng">
          {icon(ICONS.reply, "replies")}
          {fmtCount(mx.replies)}
        </span>
        <span className="eco-eng eco-eng-repost">
          {icon(ICONS.repost, "reposts")}
          {fmtCount(mx.reposts)}
        </span>
        <span className="eco-eng eco-eng-like">
          {icon(ICONS.like, "likes")}
          {fmtCount(mx.likes)}
        </span>
        <span className="eco-eng">
          {icon(ICONS.views, "views")}
          {fmtCount(mx.impressions)}
        </span>
      </div>
    </a>
  );
});

FeedCard.displayName = "FeedCard";
