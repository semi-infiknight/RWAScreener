"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PadAggregate } from "../lib/pad-aggregates";
import type { Project } from "../lib/projects";
import { isScreenerLive } from "../lib/projects";
import { formatUsd, metricOrNaN } from "../lib/tokens";
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

function fmtCount(n: number | null | undefined, loading: boolean, live: boolean): string {
  if (!live) return "—";
  if (loading) return "…";
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function fmtUsdCell(
  n: number | null | undefined,
  loading: boolean,
  live: boolean,
): string {
  if (!live) return "—";
  if (loading) return "…";
  return formatUsd(n);
}

export function EcosystemExplorer({
  projects,
}: {
  projects: Project[];
}) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [metrics, setMetrics] = useState<PadMetricsMap>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("sortOrder");
  const [asc, setAsc] = useState(true);
  /** False until a column header is clicked — default = curated sortOrder. */
  const [userSorted, setUserSorted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    async function load() {
      setMetricsLoading(true);
      try {
        const res = await fetch("/api/pads/summary", { signal: ac.signal });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        const pads: Array<PadAggregate & { id: string }> = Array.isArray(
          body.pads,
        )
          ? body.pads
          : [];
        const map: PadMetricsMap = {};
        for (const row of pads) {
          map[row.id] = {
            coins: row.coins ?? 0,
            bonding: row.bonding ?? 0,
            graduated: row.graduated ?? 0,
            mcapUsd: row.mcapUsd ?? null,
            volume24hUsd: row.volume24hUsd ?? null,
            liquidityUsd: row.liquidityUsd ?? null,
          };
        }
        setMetrics(map);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setMetrics({});
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

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
                    <th>
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("mcapUsd")}
                      >
                        Mcap{mark("mcapUsd")}
                      </button>
                    </th>
                    <th className="hide-md">
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("volume24hUsd")}
                      >
                        Vol 24h{mark("volume24hUsd")}
                      </button>
                    </th>
                    <th className="hide-lg">
                      <button
                        type="button"
                        className="sort-btn"
                        onClick={() => toggleSort("liquidityUsd")}
                      >
                        Liq{mark("liquidityUsd")}
                      </button>
                    </th>
                    <th className="col-action">App</th>
                  </tr>
                </thead>
                <tbody>
                  {metricsLoading
                    ? Array.from({ length: Math.min(8, Math.max(shown.length, 6)) }).map(
                        (_, i) => (
                          <tr key={`skel-${i}`} className="vs-row skeleton pad-row">
                            <td className="col-name" colSpan={8}>
                              <span className="skel-bar" />
                            </td>
                          </tr>
                        ),
                      )
                    : shown.map((p, idx) => {
                        const live = isScreenerLive(p);
                        const m = metrics[p.id];
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
                            <td className="num">
                              {fmtCount(m?.coins, false, live)}
                            </td>
                            <td className="num hide-sm">
                              {fmtCount(m?.bonding, false, live)}
                            </td>
                            <td className="num hide-sm">
                              {fmtCount(m?.graduated, false, live)}
                            </td>
                            <td className="num">
                              {fmtUsdCell(m?.mcapUsd, false, live)}
                            </td>
                            <td className="num hide-md">
                              {fmtUsdCell(m?.volume24hUsd, false, live)}
                            </td>
                            <td className="num hide-lg">
                              {fmtUsdCell(m?.liquidityUsd, false, live)}
                            </td>
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
