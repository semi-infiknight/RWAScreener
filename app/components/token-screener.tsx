"use client";

import { useMemo, useState } from "react";
import {
  formatAge,
  formatCompact,
  formatPct,
  formatUsd,
  metricOrNaN,
  tokensDisclaimer,
  type TokenRow,
} from "../../lib/tokens";

type TabId = "trending" | "top" | "gainers" | "new";
type SortKey =
  | "fdvUsd"
  | "volume24hUsd"
  | "change24hPct"
  | "liquidityUsd"
  | "ageHours"
  | "holders";

const TABS: { id: TabId; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "top", label: "Top" },
  { id: "gainers", label: "Gainers" },
  { id: "new", label: "New" },
];

function initials(sym: string) {
  return sym.slice(0, 2).toUpperCase();
}

function hue(sym: string) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
  return h;
}

function Sparkline({ values, up }: { values: number[] | null; up: boolean }) {
  if (!values || values.length < 2) {
    return <span className="num muted">—</span>;
  }
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
  if (pos == null || Number.isNaN(pos)) {
    return <span className="num muted">—</span>;
  }
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
  launchpadName,
  tokens,
  live = true,
  loading = false,
  ecosystemName,
}: {
  launchpadName: string;
  tokens: TokenRow[];
  live?: boolean;
  /** Live feed still fetching — never show "Not live yet". */
  loading?: boolean;
  ecosystemName?: string;
}) {
  const [tab, setTab] = useState<TabId>("trending");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("volume24hUsd");
  const [asc, setAsc] = useState(false);

  /** Only StonkOptions (screenerLive=false) gets the not-live empty state. */
  const showNotLive = !live;
  const showLoadingTable = live && loading && tokens.length === 0;
  const showLiveEmpty = live && !loading && tokens.length === 0;
  const showEmpty = showNotLive;

  const rows = useMemo(() => {
    if (showNotLive || tokens.length === 0) return [];
    const query = q.trim().toLowerCase();
    let list = tokens.filter((t) => {
      if (!query) return true;
      return (
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        (t.mint?.toLowerCase().includes(query) ?? false)
      );
    });

    if (tab === "gainers") {
      list = [...list].sort(
        (a, b) => metricOrNaN(b.change24hPct) - metricOrNaN(a.change24hPct),
      );
    } else if (tab === "new") {
      // Missing age → bottom (treat as very old when ascending by ageHours)
      list = [...list].sort((a, b) => {
        const ah = a.ageHours == null ? Number.POSITIVE_INFINITY : a.ageHours;
        const bh = b.ageHours == null ? Number.POSITIVE_INFINITY : b.ageHours;
        return ah - bh;
      });
    } else if (tab === "top") {
      list = [...list].sort(
        (a, b) => metricOrNaN(b.fdvUsd) - metricOrNaN(a.fdvUsd),
      );
    } else {
      list = [...list].sort((a, b) => {
        const score = (t: TokenRow) => {
          const vol = metricOrNaN(t.volume24hUsd);
          const ch = t.change24hPct == null ? 0 : Math.abs(t.change24hPct);
          if (vol === Number.NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY;
          return vol * (1 + ch / 100);
        };
        return score(b) - score(a);
      });
    }

    list = [...list].sort((a, b) => {
      const av = metricOrNaN(a[sort] as number | null);
      const bv = metricOrNaN(b[sort] as number | null);
      const d = av - bv;
      return asc ? d : -d;
    });

    return list;
  }, [tokens, q, tab, sort, asc, showEmpty]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(false);
    }
  };

  const mark = (key: SortKey) => (sort === key ? (asc ? " ↑" : " ↓") : "");

  return (
    <section className="vs" aria-label={`${launchpadName} token screener`}>
      <div className="vs-toolbar">
        <div className="vs-tabs" role="tablist" aria-label="Screener views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="vs-tab"
              data-active={tab === t.id}
              aria-selected={tab === t.id}
              disabled={showNotLive}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="vs-tools">
          <span className="vs-chip" data-active="true">
            24H
          </span>
          <label className="vs-search">
            <span className="sr-only">Search tokens</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              disabled={showNotLive}
            />
          </label>
        </div>
      </div>

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
            they are. No placeholder tokens by design.
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
                <th>Price / %Δ</th>
                <th className="hide-md">FDV</th>
                <th>Vol</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="vs-row skeleton">
                  <td className="col-name" colSpan={4}>
                    <span className="skel-bar" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : showLiveEmpty ? (
        <div className="vs-empty-state">
          <div className="vs-empty-badge">Live</div>
          <h3>No launches returned</h3>
          <p>
            The live feed for {launchpadName} is up, but it returned no rows
            right now. Try refreshing.
          </p>
        </div>
      ) : (
        <div className="vs-table-wrap">
          <table className="vs-table">
            <thead>
              <tr>
                <th className="col-name">Name</th>
                <th>Price / %Δ</th>
                <th className="hide-md">
                  <button type="button" className="sort-btn" onClick={() => toggleSort("fdvUsd")}>
                    FDV{mark("fdvUsd")}
                  </button>
                </th>
                <th>
                  <button type="button" className="sort-btn" onClick={() => toggleSort("volume24hUsd")}>
                    Vol{mark("volume24hUsd")}
                  </button>
                </th>
                <th className="hide-lg">Last 24h</th>
                <th className="hide-lg">24h Range</th>
                <th className="hide-md">
                  <button type="button" className="sort-btn" onClick={() => toggleSort("liquidityUsd")}>
                    Liq{mark("liquidityUsd")}
                  </button>
                </th>
                <th className="hide-sm">
                  <button type="button" className="sort-btn" onClick={() => toggleSort("ageHours")}>
                    Age{mark("ageHours")}
                  </button>
                </th>
                <th className="hide-md">
                  <button type="button" className="sort-btn" onClick={() => toggleSort("holders")}>
                    Holders{mark("holders")}
                  </button>
                </th>
                <th className="col-buy">Buy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const ch = t.change24hPct;
                const up = ch == null ? true : ch >= 0;
                const h = hue(t.symbol);
                return (
                  <tr key={t.id} className="vs-row">
                    <td className="col-name">
                      <span
                        className="token-avatar"
                        style={
                          t.icon
                            ? undefined
                            : {
                                background: `linear-gradient(145deg, hsl(${h} 72% 48%), hsl(${(h + 36) % 360} 50% 26%))`,
                              }
                        }
                      >
                        {t.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.icon} alt="" />
                        ) : (
                          initials(t.symbol)
                        )}
                      </span>
                      <span className="token-meta">
                        <span className="token-title">
                          <span className="token-name">{t.name}</span>
                          <span className="token-sym">${t.symbol}</span>
                        </span>
                        <span className="token-sub">
                          <span className="token-status" data-status={t.status}>
                            {t.status}
                          </span>
                          {t.draft ? (
                            <span className="token-status" data-status="bonding">
                              draft
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
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
                    <td className="num hide-md">{formatUsd(t.fdvUsd)}</td>
                    <td className="num">{formatUsd(t.volume24hUsd)}</td>
                    <td className="hide-lg">
                      <Sparkline values={t.spark24h} up={up} />
                    </td>
                    <td className="hide-lg">
                      <RangeBar pos={t.rangePos} />
                    </td>
                    <td className="num hide-md">{formatUsd(t.liquidityUsd)}</td>
                    <td className="num hide-sm">{formatAge(t.ageHours)}</td>
                    <td className="hide-md">
                      <div className="stack">
                        <span className="num">{formatCompact(t.holders)}</span>
                        {t.holdersDelta24h == null ? (
                          <span className="pct muted">—</span>
                        ) : (
                          <span
                            className={
                              t.holdersDelta24h >= 0 ? "pct up" : "pct down"
                            }
                          >
                            {t.holdersDelta24h >= 0 ? "+" : ""}
                            {t.holdersDelta24h}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="col-buy">
                      <button type="button" className="buy-btn" aria-label={`Buy ${t.symbol}`} disabled>
                        ⚡
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="vs-note">
        {launchpadName}
        {ecosystemName ? ` · ${ecosystemName} ecosystem` : ""} · {tokensDisclaimer}
      </p>
    </section>
  );
}
