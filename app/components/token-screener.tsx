"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatAge,
  formatCompact,
  formatPct,
  formatUsd,
  metricOrNaN,
  type TokenRow,
} from "../../lib/tokens";
import {
  defaultSortFor,
  screenerColumnsFor,
  type ScreenerColumns,
} from "../../lib/screener-columns";

type SortKey =
  | "fdvUsd"
  | "volume24hUsd"
  | "change24hPct"
  | "liquidityUsd"
  | "ageHours"
  | "holders";

/** Keep DOM small on large pads; append via IntersectionObserver. */
const INITIAL_VISIBLE_ROWS = 48;
const VISIBLE_ROW_CHUNK = 40;

/** Public IPFS gateways are flaky; prefer durable pad CDNs when present. */
const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
] as const;

/**
 * Pad/CDN hosts that already serve durable https icons.
 * Never put rotating IPFS gateways ahead of these (browser cache key thrash).
 */
const DURABLE_ICON_HOST_SUFFIXES = [
  "revshare.dev",
  "r2.dev",
  "embercurve.fun",
  "clawpump.tech",
  "ethics.ltd",
  "letsfuckingown.fun",
  "perpspad.fun",
  "cloudfront.net",
  "amazonaws.com",
  "supabase.co",
] as const;

const ICON_GW_STORAGE_PREFIX = "rwa-icon-gw:";
/** In-memory mirror of sessionStorage (SSR-safe + private-mode fallback). */
const rememberedIconByCid = new Map<string, string>();

function ipfsCid(url: string): string | null {
  if (url.startsWith("ipfs://")) {
    return url.slice("ipfs://".length).replace(/^ipfs\//, "") || null;
  }
  const m = url.match(/\/ipfs\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

function isHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

function isDurableIconHost(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (!host || host === "localhost") return true;
    return DURABLE_ICON_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function readRememberedIcon(cid: string): string | null {
  const mem = rememberedIconByCid.get(cid);
  if (mem) return mem;
  try {
    if (typeof sessionStorage === "undefined") return null;
    const v = sessionStorage.getItem(ICON_GW_STORAGE_PREFIX + cid);
    if (v) rememberedIconByCid.set(cid, v);
    return v;
  } catch {
    return null;
  }
}

function writeRememberedIcon(cid: string, url: string) {
  rememberedIconByCid.set(cid, url);
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(ICON_GW_STORAGE_PREFIX + cid, url);
  } catch {
    /* quota / private mode */
  }
}

function clearRememberedIcon(cid: string, url: string) {
  if (rememberedIconByCid.get(cid) === url) rememberedIconByCid.delete(cid);
  try {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(ICON_GW_STORAGE_PREFIX + cid) === url) {
      sessionStorage.removeItem(ICON_GW_STORAGE_PREFIX + cid);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Prefer the original https icon URL first so the browser hits a stable cache key.
 * Only append alternate IPFS gateways as onError fallbacks — never ahead of
 * durable hosts (images.revshare.dev, *.r2.dev, embercurve, clawpump, …).
 * Last-good URL per CID is sticky in sessionStorage so reloads do not thrash.
 */
function iconCandidates(icon: string | null | undefined): string[] {
  if (!icon) return [];
  if (icon.startsWith("/")) return [icon];

  const cid = ipfsCid(icon);
  if (!cid) return [icon];

  // Durable pad CDNs: never rewrite / never lead with a stale remembered gateway.
  if (isHttpUrl(icon) && isDurableIconHost(icon)) {
    return [icon];
  }

  const out: string[] = [];
  const remembered = readRememberedIcon(cid);
  // Sticky last-good gateway so reload skips a previously-failing host.
  if (remembered) out.push(remembered);

  // Prefer the source https URL before any rebuilt gateway.
  if (isHttpUrl(icon)) out.push(icon);

  // Alternate IPFS gateways as onError fallbacks only.
  for (const g of IPFS_GATEWAYS) {
    const u = `${g}${cid}`;
    if (!out.includes(u)) out.push(u);
  }

  return [...new Set(out)];
}

function TokenAvatar({
  icon,
  symbol,
}: {
  icon?: string | null;
  symbol: string;
}) {
  const cid = useMemo(() => (icon ? ipfsCid(icon) : null), [icon]);
  const candidates = useMemo(() => iconCandidates(icon), [icon]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(candidates.length === 0);
  useEffect(() => {
    setIdx(0);
    setFailed(candidates.length === 0);
  }, [candidates]);
  const h = hue(symbol);
  const src = !failed && candidates[idx] ? candidates[idx] : null;
  return (
    <span
      className="token-avatar"
      style={
        src
          ? undefined
          : {
              background: `linear-gradient(145deg, hsl(${h} 72% 48%), hsl(${(h + 36) % 360} 50% 26%))`,
            }
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={36}
          height={36}
          onLoad={() => {
            if (cid && src) writeRememberedIcon(cid, src);
          }}
          onError={() => {
            if (cid && src) clearRememberedIcon(cid, src);
            if (idx + 1 < candidates.length) setIdx((i) => i + 1);
            else setFailed(true);
          }}
        />
      ) : (
        initials(symbol)
      )}
    </span>
  );
}

function initials(sym: string) {
  return sym.slice(0, 2).toUpperCase();
}

function hue(sym: string) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
  return h;
}

function Sparkline({ values, up }: { values: number[] | null; up: boolean }) {
  if (!values || values.length < 2) return null;
  const w = 88;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = up ? "#4ade80" : "#f87171";
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function RangeBar({ pos }: { pos: number | null }) {
  if (pos == null || Number.isNaN(pos)) return null;
  const p = Math.min(1, Math.max(0, pos));
  return (
    <div className="range" aria-hidden>
      <div className="range-track">
        <span className="range-thumb" style={{ left: `${p * 100}%` }} />
      </div>
    </div>
  );
}

export function TokenScreener({
  launchpadId,
  launchpadName,
  tokens,
  live = true,
  loading = false,
  feedPending = false,
  ecosystemName,
  columns: columnsProp,
}: {
  launchpadId?: string;
  launchpadName: string;
  tokens: TokenRow[];
  live?: boolean;
  loading?: boolean;
  feedPending?: boolean;
  ecosystemName?: string;
  columns?: ScreenerColumns;
}) {
  const cols = columnsProp ?? screenerColumnsFor(launchpadId || "");
  const initialSort = defaultSortFor(cols);
  const [sort, setSort] = useState<SortKey>(initialSort.key);
  const [asc, setAsc] = useState(initialSort.asc);
  /** False until a column header is clicked — default = graduated first, then metric. */
  const [userSorted, setUserSorted] = useState(false);

  /** Progressive window: keep DOM small during fast scroll on large pads (e.g. RevShare ~462). */
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  const showNotLive = !live;
  const showLoadingTable = live && loading && tokens.length === 0;
  const showLiveEmpty = live && !loading && tokens.length === 0;
  const metricColCount = (
    Number(cols.price) +
    Number(cols.fdv) +
    Number(cols.volume) +
    Number(cols.spark) +
    Number(cols.range) +
    Number(cols.liquidity) +
    Number(cols.age) +
    Number(cols.holders)
  );
  const slimTable = metricColCount <= 2;

  const rows = useMemo(() => {
    if (showNotLive || tokens.length === 0) return [];
    const list = [...tokens];
    list.sort((a, b) => {
      // Default: graduated block first, then bonding; within block use metric.
      // Column header click sets userSorted and overrides status grouping.
      if (!userSorted) {
        const ag = a.status === "graduated" ? 0 : 1;
        const bg = b.status === "graduated" ? 0 : 1;
        if (ag !== bg) return ag - bg;
      }
      const av = metricOrNaN(a[sort] as number | null);
      const bv = metricOrNaN(b[sort] as number | null);
      return asc ? av - bv : bv - av;
    });
    return list;
  }, [tokens, sort, asc, showNotLive, userSorted]);

  // Reset window when sort / pad list identity changes (not on every enrich patch of same length).
  const rowsIdentity = `${launchpadId || ""}:${rows.length}:${sort}:${asc}:${userSorted}`;
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }, [rowsIdentity]);

  const visibleRows = useMemo(
    () => rows.slice(0, Math.min(visibleCount, rows.length)),
    [rows, visibleCount],
  );
  const hasMore = visibleCount < rows.length;

  const loadMore = useCallback(() => {
    setVisibleCount((n) => Math.min(rows.length, n + VISIBLE_ROW_CHUNK));
  }, [rows.length]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadMore, visibleRows.length]);

  function toggleSort(key: SortKey) {
    setUserSorted(true);
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(false);
    }
  }

  function mark(key: SortKey) {
    if (sort !== key) return "";
    return asc ? " ↑" : " ↓";
  }

  return (
    <section className="vs-screener" aria-label={`${launchpadName} tokens`}>
      {showNotLive ? (
        <div className="vs-empty-state">
          <div className="vs-empty-badge">Not live yet</div>
          <h3>{launchpadName} launches coming soon</h3>
          <p>
            {ecosystemName ? (
              <>
                Part of the <strong>{ecosystemName}</strong> ecosystem.{" "}
              </>
            ) : null}
            Token launches are not live yet — this screener stays empty until
            they are.
          </p>
          <div className="vs-empty-tags">
            <span className="tag">integrating</span>
            <span className="tag">DBC integrating</span>
            {ecosystemName ? <span className="tag">{ecosystemName}</span> : null}
          </div>
        </div>
      ) : showLoadingTable ? (
        <div className="vs-table-wrap">
          <table className="vs-table vs-table-loading">
            <thead>
              <tr>
                <th className="col-name">Name</th>
                {cols.price ? <th>Price / %Δ</th> : null}
                {cols.fdv ? <th className="hide-md">FDV</th> : null}
                {cols.volume ? <th>Vol</th> : null}
                {cols.age ? <th className="vs-age">Age</th> : null}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="vs-row skeleton">
                  <td className="col-name" colSpan={6}>
                    <span className="skel-bar" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : showLiveEmpty ? (
        <div className="vs-empty-state">
          <div className="vs-empty-badge">{feedPending ? "Pending" : "No rows"}</div>
          <h3>
            {feedPending
              ? `${launchpadName} feed not wired yet`
              : `No tokens from ${launchpadName}`}
          </h3>
          <p>
            {feedPending
              ? "This pad still returns an empty pending stub — no invented rows."
              : "The live pad API returned zero tokens."}
          </p>
        </div>
      ) : (
        <div className="vs-table-wrap">
          <table className="vs-table" data-slim={slimTable ? "true" : undefined}>
            <thead>
              <tr>
                <th className="col-name">Name</th>
                {cols.price ? <th>Price / %Δ</th> : null}
                {cols.fdv ? (
                  <th className="hide-md">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("fdvUsd")}>
                      FDV{mark("fdvUsd")}
                    </button>
                  </th>
                ) : null}
                {cols.volume ? (
                  <th>
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggleSort("volume24hUsd")}
                    >
                      Vol{mark("volume24hUsd")}
                    </button>
                  </th>
                ) : null}
                {cols.spark ? <th className="hide-lg">Last 24h</th> : null}
                {cols.range ? <th className="hide-lg">24h Range</th> : null}
                {cols.liquidity ? (
                  <th className="hide-md">
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggleSort("liquidityUsd")}
                    >
                      Liq{mark("liquidityUsd")}
                    </button>
                  </th>
                ) : null}
                {cols.age ? (
                  <th className="vs-age">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("ageHours")}>
                      Age{mark("ageHours")}
                    </button>
                  </th>
                ) : null}
                {cols.holders ? (
                  <th className="hide-md">
                    <button type="button" className="sort-btn" onClick={() => toggleSort("holders")}>
                      Holders{mark("holders")}
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((t) => {
                const ch = t.change24hPct;
                const up = ch == null ? true : ch >= 0;
                return (
                  <tr key={t.id} className="vs-row">
                    <td className="col-name">
                      <TokenAvatar icon={t.icon} symbol={t.symbol} />
                      <span className="token-meta">
                        <span className="token-title">
                          <span className="token-name">{t.name}</span>
                          <span className="token-sym">${t.symbol}</span>
                        </span>
                        <span className="token-sub">
                          <span className="token-status" data-status={t.status}>
                            {t.status}
                          </span>
                        </span>
                      </span>
                    </td>
                    {cols.price ? (
                      <td>
                        <div className="stack">
                          <span className="num">{formatUsd(t.priceUsd)}</span>
                          <span
                            className={
                              ch == null ? "pct muted" : up ? "pct up" : "pct down"
                            }
                          >
                            {formatPct(ch)}
                          </span>
                        </div>
                      </td>
                    ) : null}
                    {cols.fdv ? (
                      <td className="num hide-md">{formatUsd(t.fdvUsd)}</td>
                    ) : null}
                    {cols.volume ? (
                      <td className="num">{formatUsd(t.volume24hUsd)}</td>
                    ) : null}
                    {cols.spark ? (
                      <td className="hide-lg">
                        <Sparkline values={t.spark24h} up={up} />
                      </td>
                    ) : null}
                    {cols.range ? (
                      <td className="hide-lg">
                        <RangeBar pos={t.rangePos} />
                      </td>
                    ) : null}
                    {cols.liquidity ? (
                      <td className="num hide-md">{formatUsd(t.liquidityUsd)}</td>
                    ) : null}
                    {cols.age ? (
                      <td className="num vs-age">{formatAge(t.ageHours)}</td>
                    ) : null}
                    {cols.holders ? (
                      <td className="hide-md">
                        <span className="num">{formatCompact(t.holders)}</span>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {hasMore ? (
                <tr ref={sentinelRef} className="vs-row vs-row-sentinel" aria-hidden>
                  <td colSpan={1 + metricColCount}>
                    <span className="vs-load-more muted">Loading more…</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
