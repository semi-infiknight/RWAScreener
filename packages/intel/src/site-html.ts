import { BUCKETS, type BucketId } from "./buckets.js";
import type { MentionRecord } from "./store.js";
import {
  bucketLabel,
  type Lane,
  type LeaderRow,
  type PostType,
  type TimeWindow,
  windowCounts,
} from "./site-data.js";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

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

/** X-style compact social counts: 0 → 0, 1234 → 1.2K, 2.5M. */
function fmtCount(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** X's engagement icons (same paths X uses). */
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

function icon(path: string, label: string): string {
  return `<svg viewBox="0 0 24 24" aria-label="${esc(label)}" class="icon" fill="currentColor"><path d="${path}"/></svg>`;
}

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
];

export type PageModel = {
  view: "feed" | "leaderboard";
  window: TimeWindow;
  lane: Lane;
  postType: PostType;
  q: string;
  bucket: string;
  feed: MentionRecord[];
  board: LeaderRow[];
  counts: ReturnType<typeof windowCounts>;
  officialCount: number;
  totalStored: number;
  noiseHidden: number;
  page: number;
  totalPages: number;
  totalFeed: number;
};

function renderPagination(model: PageModel): string {
  const base = {
    window: model.window,
    lane: model.lane,
    type: model.postType,
    q: model.q || undefined,
    bucket: model.bucket || undefined,
  };
  const path = model.view === "leaderboard" ? "/leaderboard" : "/";
  const prev = model.page > 1 ? `<a class="page-nav" href="${esc(path + qs({ ...base, page: String(model.page - 1) }))}">← Prev</a>` : "";
  const next = model.page < model.totalPages ? `<a class="page-nav" href="${esc(path + qs({ ...base, page: String(model.page + 1) }))}">Next →</a>` : "";
  return `<nav class="pagination" aria-label="Feed pages">
    ${prev}
    <span class="page-info">${model.page} / ${model.totalPages} <span class="page-total">(${model.totalFeed} posts)</span></span>
    ${next}
  </nav>`;
}

function statusLine(model: PageModel): string {
  if (model.view === "leaderboard") {
    const n = model.board.length;
    return n === 1 ? "1 account" : `${n} accounts`;
  }
  if (model.lane === "official") {
    return model.totalFeed === 1 ? "1 official" : `${model.totalFeed} official`;
  }
  return `${model.totalFeed} in view · ${model.officialCount} official`;
}

export function renderPage(model: PageModel): string {
  const base = {
    window: model.window,
    lane: model.lane,
    type: model.postType,
    q: model.q || undefined,
    bucket: model.bucket || undefined,
  };
  const path = model.view === "leaderboard" ? "/leaderboard" : "/";
  const chips = WINDOWS.map((w) => {
    const active = w.id === model.window ? " is-active" : "";
    const href = path + qs({ ...base, window: w.id });
    return `<a class="tab${active}" href="${esc(href)}">${esc(w.label)} <span>${model.counts[w.id]}</span></a>`;
  }).join("");

  const lanes = (
    [
      { id: "ecosystem" as Lane, label: "Ecosystem" },
      { id: "official" as Lane, label: "Official" },
    ]
  )
    .map((l) => {
      const active = l.id === model.lane ? " is-active" : "";
      const href = "/" + qs({ ...base, lane: l.id, bucket: undefined });
      return `<a class="tab${active}" href="${esc(href)}">${esc(l.label)}</a>`;
    })
    .join("");

  // posts/replies pill toggle (bigweek-style)
  const postTypes: { id: PostType; label: string }[] = [
    { id: "posts", label: "posts" },
    { id: "replies", label: "replies" },
  ];
  const toggle = postTypes
    .map((t) => {
      const active = t.id === model.postType ? " is-active" : "";
      const href =
        (model.view === "leaderboard" ? "/leaderboard" : "/") +
        qs({ ...base, type: t.id, bucket: undefined });
      return `<a class="toggle-opt${active}" href="${esc(href)}">${esc(t.label)}</a>`;
    })
    .join("");
  const postToggle =
    model.view === "feed"
      ? `<div class="toggle" role="tablist" aria-label="Post type">${toggle}</div>`
      : "";

  const topicOptions = BUCKETS.filter((b) => !b.suppress && b.id !== "official_meteora")
    .map((b) => {
      const sel = model.bucket === b.id ? " selected" : "";
      return `<option value="${esc(b.id)}"${sel}>${esc(b.label)}</option>`;
    })
    .join("");
  const showTopics = !(model.lane === "official" && model.view === "feed");
  const topicSelect = showTopics
    ? `<form class="topics" method="get" action="${esc(path)}">
      <input type="hidden" name="window" value="${esc(model.window)}" />
      <input type="hidden" name="lane" value="${esc(model.lane)}" />
      <input type="hidden" name="type" value="${esc(model.postType)}" />
      ${model.q ? `<input type="hidden" name="q" value="${esc(model.q)}" />` : ""}
      <label class="sr" for="bucket">Topic</label>
      <select id="bucket" name="bucket" onchange="this.form.submit()">
        <option value="">All topics</option>
        ${topicOptions}
      </select>
    </form>`
    : "";

  const body =
    model.view === "leaderboard" ? renderBoard(model.board) : renderFeed(model.feed, model.lane);

  // Pagination: prev / page indicator / next
  const pagination =
    model.view === "feed" && model.totalPages > 1
      ? renderPagination(model)
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meteora Intel — ${model.view === "leaderboard" ? "Leaderboard" : "Live feed"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>${css()}</style>
</head>
<body>
  <a class="skip" href="#main">Skip to feed</a>
  <header class="top">
    <div class="brand">
      <h1><a href="/">Meteora Intel</a></h1>
    </div>
    <nav>
      <a href="${esc("/" + qs(base))}"${model.view === "feed" ? ' aria-current="page"' : ""}>Feed</a>
      <a href="${esc("/leaderboard" + qs(base))}"${model.view === "leaderboard" ? ' aria-current="page"' : ""}>Leaderboard</a>
    </nav>
  </header>

  <div class="filters">
    ${model.view === "feed" ? `<div class="tabs" role="tablist" aria-label="Lane">${lanes}</div>` : ""}
    ${postToggle}
    <div class="tabs" role="tablist" aria-label="Time window">${chips}</div>
    ${topicSelect}
    <form class="search" method="get" action="${esc(path)}">
      <input type="hidden" name="window" value="${esc(model.window)}" />
      <input type="hidden" name="lane" value="${esc(model.lane)}" />
      <input type="hidden" name="type" value="${esc(model.postType)}" />
      ${model.bucket ? `<input type="hidden" name="bucket" value="${esc(model.bucket)}" />` : ""}
      <label class="sr" for="q">Search text or @handle</label>
      <input id="q" name="q" type="search" placeholder="Search @handle or text" value="${esc(model.q)}" autocomplete="off" />
      <button class="sr" type="submit">Search</button>
    </form>
  </div>

  <main id="main">
    <p class="live">${statusLine(model)} <span class="dot" aria-hidden="true"></span></p>
    ${body}
    ${pagination}
  </main>
  <footer>
    <p>Local BGE classifier. Official accounts in their own lane. Hourly scan.</p>
  </footer>
</body>
</html>`;
}

function renderFeed(feed: MentionRecord[], lane: Lane): string {
  if (feed.length === 0) {
    const msg =
      lane === "official"
        ? "No official Meteora posts in this window"
        : "No ecosystem posts in this window";
    return `<div class="empty">
      <h2>${msg}</h2>
      <p>The hourly scanner pushes new posts here as they land on X.</p>
    </div>`;
  }
  // Masonry: distribute cards across N columns (bigweek-style flex columns).
  // Each column is an independent vertical stack so short cards don't stretch
  // to match tall ones — no empty gaps.
  const COLS = 3;
  const columns: MentionRecord[][] = Array.from({ length: COLS }, () => []);
  for (let i = 0; i < feed.length; i++) {
    columns[i % COLS]!.push(feed[i]!);
  }
  return `<div class="masonry">${columns
    .map(
      (col) =>
        `<ol class="col">${col.map(card).join("")}</ol>`,
    )
    .join("")}</div>`;
}

/** pbs photos accept sizing params; small (~680px) is plenty for a 2-col card. */
function mediaSrc(url: string): string {
  return url.includes("pbs.twimg.com/media/") && !url.includes("name=")
    ? `${url}?name=small`
    : url;
}

function card(m: MentionRecord): string {
  const handle = m.author?.username || "unknown";
  const name = m.author?.name || handle;
  const bucket = m.classification.primary;
  const when = relativeTime(m.createdAt || m.scannedAt);
  const verified = m.author?.verified
    ? icon(ICONS.verified, "verified")
    : "";
  const avatar = m.author?.avatarUrl
    ? `<img class="avatar" src="${esc(m.author.avatarUrl)}" alt="@${esc(handle)}" width="36" height="36" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<span class="avatar avatar-letter" aria-hidden="true">${esc(handle.slice(0, 1).toUpperCase())}</span>`;
  const media = (m.media ?? []).slice(0, 4);
  const mediaHtml = media.length
    ? `<span class="media m${media.length}">${media
        .map(
          (md) =>
            `<img src="${esc(mediaSrc(md.url))}" alt="Media attached to post by @${esc(handle)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`,
        )
        .join("")}</span>`
    : "";
  const mx = m.metrics ?? {};
  return `<li class="card">
    <a class="card-link" href="${esc(m.url)}" rel="noopener noreferrer" aria-label="Open post by @${esc(handle)} on X">
      <header>
        ${avatar}
        <span class="who">
          <span class="name-row"><strong>${esc(name)}</strong>${verified}</span>
          <span class="meta">@${esc(handle)} · ${esc(when)}${m.isQuote ? " · quote" : ""}</span>
        </span>
      </header>
      <p>${esc(m.text)}</p>
      ${mediaHtml}
      <span class="topic">${esc(bucketLabel(bucket))}</span>
      <footer class="engagement">
        <span title="replies">${icon(ICONS.reply, "replies")}${fmtCount(mx.replies)}</span>
        <span title="reposts" class="eng-repost">${icon(ICONS.repost, "reposts")}${fmtCount(mx.reposts)}</span>
        <span title="likes" class="eng-like">${icon(ICONS.like, "likes")}${fmtCount(mx.likes)}</span>
        <span title="views">${icon(ICONS.views, "views")}${fmtCount(mx.impressions)}</span>
      </footer>
    </a>
  </li>`;
}

function renderBoard(board: LeaderRow[]): string {
  if (board.length === 0) {
    return `<div class="empty">
      <h2>No accounts in this window</h2>
      <p>Seed the store with demo scan, then open Leaderboard again.</p>
    </div>`;
  }
  const rows = board
    .map(
      (r, i) => `<tr>
        <td class="rank">${i + 1}</td>
        <td>
          <a href="${esc(r.sampleUrl)}" rel="noopener noreferrer">@${esc(r.handle)}</a>
          <div class="sub">${esc(r.name)}</div>
        </td>
        <td>${r.posts}</td>
        <td>${r.leadScoreSum.toFixed(2)}</td>
        <td><span class="topic">${esc(bucketLabel(r.topBucket))}</span></td>
      </tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table>
    <caption class="sr">Accounts ranked by summed lead score</caption>
    <thead><tr><th>#</th><th>Account</th><th>Posts</th><th>Lead</th><th>Top bucket</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function css(): string {
  return `
:root {
  --bg: #0c0d0a;
  --ink: #e8eadf;
  --muted: #9aa18a;
  --line: #2a2d22;
  --card: #161812;
  --acid: #d4ff4a;
  --acid-ink: #14160f;
  --focus: #9ad4ff;
  --eng: #6e767d;
  --page: 1240px;
  --gutter: 24px;
  --ease: cubic-bezier(0, 0, 0.2, 1);
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font-family: "IBM Plex Sans", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
a { color: inherit; }
.skip { position: absolute; left: -999px; }
.skip:focus { left: 12px; top: 12px; background: var(--ink); color: var(--bg); padding: 8px 12px; z-index: 9; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.top { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px var(--gutter) 8px; max-width: var(--page); margin: 0 auto; }
h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }
h1 a { text-decoration: none; }
nav { display: flex; gap: 4px; }
nav a { min-height: 40px; display: inline-flex; align-items: center; padding: 0 10px; text-decoration: none; font-size: 14px; color: var(--muted); box-shadow: inset 0 -1px 0 transparent; }
nav a[aria-current="page"] { color: var(--ink); box-shadow: inset 0 -1px 0 var(--acid); }
nav a:focus-visible, .tab:focus-visible, .toggle-opt:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, .card-link:focus-visible, table a:focus-visible {
  outline: 2px solid var(--focus); outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .card, .toggle-opt, .page-nav { transition: none; }
}
.filters { max-width: var(--page); margin: 4px auto 0; padding: 8px var(--gutter) 4px; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.tabs { display: flex; flex-wrap: wrap; gap: 2px; }
.tab { min-height: 40px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px; text-decoration: none; font-size: 13px; color: var(--muted); }
.tab span { font-variant-numeric: tabular-nums; font-size: 12px; opacity: 0.7; }
.tab.is-active { color: var(--ink); box-shadow: inset 0 -1px 0 var(--acid); }
.tab:hover { color: var(--ink); }
.search { margin-left: auto; }
.search input { min-height: 40px; min-width: 180px; width: 220px; background: transparent; border: 0; border-bottom: 1px solid var(--line); color: var(--ink); padding: 0 2px; font: inherit; font-size: 13px; border-radius: 0; }
.search input:focus { outline: none; border-bottom-color: var(--ink); }
.search input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.topics select { min-height: 40px; background: transparent; border: 0; color: var(--muted); font: inherit; font-size: 13px; padding: 0 4px; max-width: 220px; cursor: pointer; }
.topics select:hover, .topics select:focus { color: var(--ink); }
main { max-width: var(--page); margin: 0 auto; padding: 4px var(--gutter) 48px; }
.live { margin: 8px 0 16px; font-size: 12px; color: var(--muted); letter-spacing: 0; text-transform: none; }
.dot { display: inline-block; width: 5px; height: 5px; background: var(--acid); border-radius: 99px; margin-left: 8px; vertical-align: middle; }
.masonry { display: flex; align-items: flex-start; gap: 16px; }
.masonry .col { list-style: none; padding: 0; margin: 0; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; transition: border-color 100ms var(--ease); }
.card:has(.card-link:hover) { border-color: #3a3d32; }
.card-link { display: block; padding: 14px 14px 12px; text-decoration: none; min-height: 40px; }
.card-link header { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.avatar { width: 40px; height: 40px; border-radius: 999px; object-fit: cover; flex: none; }
.avatar-letter { display: grid; place-items: center; background: #222616; color: var(--ink); font-weight: 600; }
.who { flex: 1; display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.who strong { font-size: 15px; font-weight: 600; }
.meta { color: var(--muted); font-size: 13px; }
.card p { margin: 0 0 10px; line-height: 1.45; font-size: 15px; white-space: pre-wrap; word-break: break-word; }
.media { display: grid; gap: 2px; margin: 0 -14px 10px; }
.media.m1 { grid-template-columns: 1fr; }
.media.m2, .media.m3, .media.m4 { grid-template-columns: 1fr 1fr; }
.media img { width: 100%; max-height: 280px; object-fit: cover; display: block; background: #000; }
.topic { display: block; margin: 0 0 8px; font-size: 11px; color: var(--muted); letter-spacing: 0.02em; }
.toggle { display: inline-flex; align-items: center; padding: 2px; border: 1px solid var(--line); border-radius: 999px; }
.toggle-opt { min-height: 40px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; font-size: 12px; color: var(--muted); text-decoration: none; transition: background 100ms var(--ease), color 100ms var(--ease); }
.toggle-opt.is-active { background: var(--ink); color: var(--bg); }
.toggle-opt:not(.is-active):hover { color: var(--ink); }
.name-row { display: flex; align-items: center; gap: 4px; min-width: 0; flex-wrap: wrap; }
.icon { width: 14px; height: 14px; flex: none; }
.name-row .icon { color: var(--eng); }
.card footer.engagement { display: flex; align-items: center; gap: 16px; color: var(--eng); font-size: 13px; font-variant-numeric: tabular-nums; }
.card footer.engagement > span { display: inline-flex; align-items: center; gap: 5px; min-height: 24px; }
.card footer.engagement .eng-repost:hover { color: #00ba7c; }
.card footer.engagement .eng-like:hover { color: #f91880; }
.empty { border: 1px dashed var(--line); padding: 32px; border-radius: 12px; }
.empty h2 { margin-top: 0; font-size: 18px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); }
th { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
.rank { font-variant-numeric: tabular-nums; color: var(--muted); width: 40px; }
.sub { color: var(--muted); font-size: 12px; }
footer { max-width: var(--page); margin: 0 auto; padding: 0 var(--gutter) 40px; color: var(--muted); font-size: 13px; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 28px 0 8px; font-size: 13px; }
.page-nav { min-height: 40px; display: inline-flex; align-items: center; padding: 0 12px; text-decoration: none; color: var(--muted); transition: color 100ms var(--ease); }
.page-nav:hover { color: var(--ink); }
.page-info { color: var(--muted); }
.page-total { opacity: 0.7; }
@media (max-width: 768px) {
  .masonry .col:nth-child(3) { display: none; }
  .top { flex-direction: column; align-items: flex-start; }
  .filters { flex-direction: column; align-items: flex-start; }
  .search { margin-left: 0; width: 100%; }
}
@media (max-width: 520px) {
  .masonry { flex-direction: column; }
  .masonry .col:nth-child(2) { display: none; }
  .masonry .col:first-child { display: flex; }
  .search input { width: 100%; min-width: 0; }
}
`;
}
