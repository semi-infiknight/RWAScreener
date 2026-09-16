"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FAILED_PAD_AGGREGATE,
  type PadAggregate,
} from "../lib/pad-aggregates";
import type { Project } from "../lib/projects";
import { isScreenerLive } from "../lib/projects";
import { formatUsd } from "../lib/tokens";
import {
  HOME_METRICS_CACHE,
  HOME_METRICS_MAX_AGE_MS,
  readStale,
  writeStale,
} from "../lib/client-stale-cache";
import { HeroDark } from "./hero-dark";

const PAGE_SIZE = 15;
const AVATAR_COLORS = [
  "#ff6a00",
  "#ff8a1a",
  "#ffb347",
  "#e85d04",
  "#f48c06",
  "#dc2f02",
];
/** Retries per pad so a cold first fetch (e.g. Ember) does not pin zeros. */
const PAD_FETCH_ATTEMPTS = 3;

type SortKey =
  | "sortOrder"
  | "coins"
  | "bonding"
  | "graduated"
  | "mcapUsd"
  | "volume24hUsd"
  | "liquidityUsd";

type PadMetricsMap = Record<string, PadAggregate | undefined>;

function domainOf(website: string | null): string {
  if (!website) return "—";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function curatedOrder(p: Project): number {
  return typeof p.sortOrder === "number" ? p.sortOrder : Number.MAX_SAFE_INTEGER;
}

function CellLoader() {
  return (
    <span className="cell-loader" aria-hidden="true" title="Loading" />
  );
}

/** Pending → mini spinner; non-live / null → —; real 0 only after successful load. */
function fmtCount(
  n: number | null | undefined,
  loading: boolean,
  live: boolean,
): ReactNode {
  if (!live) return "—";
  if (loading) return <CellLoader />;
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function fmtUsdCell(
  n: number | null | undefined,
  loading: boolean,
  live: boolean,
): ReactNode {
  if (!live) return "—";
  if (loading) return <CellLoader />;
  return formatUsd(n);
}

function parsePadRow(body: unknown, resOk: boolean): PadAggregate | null {
  const row =
    body && typeof body === "object" && "pad" in body
      ? (body as { pad?: Record<string, unknown> }).pad
      : undefined;
  if (!resOk || !row || typeof row !== "object") return null;
  if (row.ok === false) return null;

  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  return {
    // Do not coerce missing → 0 (that looked like a loaded zero on fail).
    coins: numOrNull(row.coins),
    bonding: numOrNull(row.bonding),
    graduated: numOrNull(row.graduated),
    mcapUsd: numOrNull(row.mcapUsd),
    volume24hUsd: numOrNull(row.volume24hUsd),
    liquidityUsd: numOrNull(row.liquidityUsd),
  };
}

export function EcosystemExplorer({
  projects,
  initialMetrics = {},
}: {
  projects: Project[];
  /** SSR Redis peek — shared snapshot for every visitor, including first paint. */
  initialMetrics?: PadMetricsMap;
}) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [metrics, setMetrics] = useState<PadMetricsMap>(() => {
    // Prefer shared SSR snapshot; fall back to this browser's session cache.
    const stale = readStale<PadMetricsMap>(
      HOME_METRICS_CACHE,
      HOME_METRICS_MAX_AGE_MS,
    );
    const fromSession = stale?.value ?? {};
    return { ...fromSession, ...initialMetrics };
  });
  const [quotePools, setQuotePools] = useState<Record<string, number> | null>(
    null,
  );
  const [sort, setSort] = useState<SortKey>("sortOrder");
  const [asc, setAsc] = useState(true);
  /** False until a column header is clicked — default = curated sortOrder. */
  const [userSorted, setUserSorted] = useState(false);

  // Stale-while-revalidate: paint SSR/session snapshot, refresh in parallel.
  useEffect(() => {
    if (Object.keys(initialMetrics).length > 0) {
      writeStale(HOME_METRICS_CACHE, { ...initialMetrics });
    }
    let cancelled = false;
    const ac = new AbortController();

    const livePads = [...projects]
      .filter((p) => isScreenerLive(p))
      .sort((a, b) => curatedOrder(a) - curatedOrder(b));

    async function loadOne(id: string): Promise<PadAggregate | null> {
      const res = await fetch(
        `/api/pads/summary?pad=${encodeURIComponent(id)}`,
        { signal: ac.signal },
      );
      const body = await res.json().catch(() => ({}));
      return parsePadRow(body, res.ok);
    }

    async function loadWithRetry(id: string): Promise<PadAggregate> {
      let lastErr: unknown;
      for (let attempt = 0; attempt < PAD_FETCH_ATTEMPTS; attempt++) {
        if (cancelled) return { ...FAILED_PAD_AGGREGATE };
        try {
          const agg = await loadOne(id);
          if (agg) return agg;
          lastErr = new Error("empty/failed pad summary");
        } catch (err) {
          if (
            cancelled ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            throw err;
          }
          lastErr = err;
        }
        if (attempt < PAD_FETCH_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }
      void lastErr;
      return { ...FAILED_PAD_AGGREGATE };
    }

    async function loadParallel() {
      await Promise.all(
        livePads.map(async (p) => {
          if (cancelled) return;
          try {
            const agg = await loadWithRetry(p.id);
            if (cancelled) return;
            setMetrics((prev) => {
              const next = { ...prev, [p.id]: agg };
              writeStale(HOME_METRICS_CACHE, next);
              return next;
            });
          } catch (err) {
            if (
              cancelled ||
              (err instanceof DOMException && err.name === "AbortError")
            ) {
              return;
            }
            setMetrics((prev) => {
              // Keep prior good cell if we already had one (stale or earlier).
              if (prev[p.id] && prev[p.id] !== undefined) {
                const existing = prev[p.id]!;
                if (existing.coins != null || existing.mcapUsd != null) {
                  return prev;
                }
              }
              const next = {
                ...prev,
                [p.id]: { ...FAILED_PAD_AGGREGATE },
              };
              writeStale(HOME_METRICS_CACHE, next);
              return next;
            });
          }
        }),
      );
    }

    void loadParallel();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [projects, initialMetrics]);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/staging/launchpads", {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) {
          setQuotePools({});
          return;
        }
        const body = await res.json();
        const pads = Array.isArray(body.launchpads) ? body.launchpads : [];
        const map: Record<string, number> = {};
        for (const lp of pads) {
          const id =
            typeof lp?.launchpadId === "string" ? lp.launchpadId.trim() : "";
          if (!id || !lp?.labeled) continue;
          const n = typeof lp.pool_count === "number" ? lp.pool_count : 0;
          map[id] = (map[id] ?? 0) + n;
        }
        setQuotePools(map);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setQuotePools({});
      }
    })();
    return () => ac.abort();
  }, []);

  const metricsPending = useMemo(() => {
    return projects.some((p) => isScreenerLive(p) && metrics[p.id] === undefined);
  }, [projects, metrics]);

  const showVol = useMemo(() => {
    if (metricsPending) return true; // keep column while still filling
    let n = 0;
    for (const m of Object.values(metrics)) {
      if (m?.volume24hUsd != null && m.volume24hUsd !== 0) n += 1;
    }
    return n >= 1;
  }, [metrics, metricsPending]);

  const showLiq = useMemo(() => {
    if (metricsPending) return true;
    let n = 0;
    for (const m of Object.values(metrics)) {
      if (m?.liquidityUsd != null && m.liquidityUsd !== 0) n += 1;
    }
    // Hide when almost no pads report liq (after enrich).
    return n >= 2;
  }, [metrics, metricsPending]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const hay = [
        p.displayName,
        p.slug,
        p.summary,
        p.website ?? "",
        ...p.built,
        ...p.verified,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (!userSorted) {
      list.sort((a, b) => curatedOrder(a) - curatedOrder(b));
      return list;
    }
    list.sort((a, b) => {
      if (sort === "sortOrder") {
        return asc
          ? curatedOrder(a) - curatedOrder(b)
          : curatedOrder(b) - curatedOrder(a);
      }
      const aLive = isScreenerLive(a);
      const bLive = isScreenerLive(b);
      const am = aLive ? metrics[a.id] : undefined;
      const bm = bLive ? metrics[b.id] : undefined;
      const rawA = am?.[sort] as number | null | undefined;
      const rawB = bm?.[sort] as number | null | undefined;
      // Non-live / null metric fields sink regardless of direction.
      const aMissing = !aLive || rawA == null || Number.isNaN(rawA);
      const bMissing = !bLive || rawB == null || Number.isNaN(rawB);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (aMissing && bMissing) return curatedOrder(a) - curatedOrder(b);
      const av = rawA as number;
      const bv = rawB as number;
      return asc ? av - bv : bv - av;
    });
    return list;
  }, [filtered, metrics, sort, asc, userSorted]);

  const shown = sorted.slice(0, visible);

  function toggleSort(key: SortKey) {
    setUserSorted(true);
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(false);
    }
  }

  function mark(key: SortKey) {
    if (!userSorted || sort !== key) return "";
    return asc ? " ↑" : " ↓";
  }

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <div className="hero-lockup">
          <h1 className="hero-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero-title-mark"
              src="/favicon.svg"
              alt=""
              width={48}
              height={48}
            />
            <span className="hero-title-text">
              <span className="hero-title-light">The </span>
              <span className="hero-title-brand">Meteora</span>
              <span className="hero-title-light"> DBC Screener</span>
            </span>
          </h1>
          <p className="hero-sub">limited to stock quote mint pairs</p>
        </div>
      </section>

      <div className="shell">
        <div className="panel">
          <label className="search search-list">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search"
              aria-label="Search projects"
            />
            {query ? (
              <button
                type="button"
                className="ext"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            ) : null}
          </label>

          <div className="pad-table-wrap">
            {shown.length === 0 ? (
              <div className="empty">No projects match.</div>
            ) : (
              <table className="pad-table vs-table" aria-label="Launchpad metrics">
                <thead>
                  <tr>
                    <th className="col-name">Name</th>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("coins")}
                      >
                        Coins{mark("coins")}
                      </button>
                    </th>
                    <th className="hide-sm">
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("bonding")}
                      >
                        Bonding{mark("bonding")}
                      </button>
                    </th>
                    <th className="hide-sm">
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("graduated")}
                      >
                        Graduated{mark("graduated")}
                      </button>
                    </th>
                    <th className="hide-md" title="Post-cutoff stock-quote DBC pools from the on-chain indexer. Not an endorsement.">
                      Quote pools
                    </th>
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("mcapUsd")}
                      >
                        Total mcap{mark("mcapUsd")}
                      </button>
                    </th>
                    {showVol ? (
                      <th className="hide-md">
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => toggleSort("volume24hUsd")}
                        >
                          Vol 24h{mark("volume24hUsd")}
                        </button>
                      </th>
                    ) : null}
                    {showLiq ? (
                      <th className="hide-lg">
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => toggleSort("liquidityUsd")}
                        >
                          Liq{mark("liquidityUsd")}
                        </button>
                      </th>
                    ) : null}
                    <th className="col-action">App</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, idx) => {
                    const live = isScreenerLive(p);
                    const m = metrics[p.id];
                    const rowLoading = live && m === undefined;
                    const appHref = p.website ?? p.x ?? p.docs ?? null;
                    return (
                      <tr key={p.id} className="vs-row pad-row">
                        <td className="col-name">
                          <Link
                            href={`/projects/${p.slug}`}
                            className="pad-name-link"
                          >
                            <span
                              className="avatar"
                              style={
                                "icon" in p && p.icon
                                  ? undefined
                                  : {
                                      background:
                                        AVATAR_COLORS[
                                          idx % AVATAR_COLORS.length
                                        ],
                                    }
                              }
                            >
                              {"icon" in p && p.icon ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.icon} alt="" />
                              ) : (
                                initials(p.displayName)
                              )}
                            </span>
                            <span className="identity">
                              <div className="name">{p.displayName}</div>
                              <div className="domain">
                                {domainOf(p.website)}
                              </div>
                            </span>
                          </Link>
                        </td>
                        <td className="num" aria-busy={rowLoading || undefined}>
                          {fmtCount(m?.coins, rowLoading, live)}
                        </td>
                        <td
                          className="num hide-sm"
                          aria-busy={rowLoading || undefined}
                        >
                          {fmtCount(m?.bonding, rowLoading, live)}
                        </td>
                        <td
                          className="num hide-sm"
                          aria-busy={rowLoading || undefined}
                        >
                          {fmtCount(m?.graduated, rowLoading, live)}
                        </td>
                        <td
                          className="num hide-md"
                          title="On-chain stock-quote DBC pools after cutoff. Not an endorsement."
                        >
                          {quotePools == null ? (
                            <CellLoader />
                          ) : quotePools[p.id] != null ? (
                            quotePools[p.id].toLocaleString()
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num" aria-busy={rowLoading || undefined}>
                          {fmtUsdCell(m?.mcapUsd, rowLoading, live)}
                        </td>
                        {showVol ? (
                          <td
                            className="num hide-md"
                            aria-busy={rowLoading || undefined}
                          >
                            {fmtUsdCell(m?.volume24hUsd, rowLoading, live)}
                          </td>
                        ) : null}
                        {showLiq ? (
                          <td
                            className="num hide-lg"
                            aria-busy={rowLoading || undefined}
                          >
                            {fmtUsdCell(m?.liquidityUsd, rowLoading, live)}
                          </td>
                        ) : null}
                        <td className="col-action">
                          {appHref ? (
                            <a
                              className="go-to-app go-to-app-table"
                              href={appHref}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Go to ${p.displayName} app`}
                            >
                              GO TO APP ↗
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {visible < sorted.length ? (
            <div className="more-wrap">
              <button
                type="button"
                className="more"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                View More
              </button>
            </div>
          ) : null}
        </div>

        <div className="footer-cta">
          <Link href="/quotes" className="footer-cta-secondary">
            Quotes
          </Link>
          <a
            href="https://docs.meteora.ag/core-products/dbc/what-is-dbc"
            target="_blank"
            rel="noreferrer"
          >
            Build on Meteora DBC →
          </a>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
