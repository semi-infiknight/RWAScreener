"use client";

import { useMemo, useState } from "react";
import {
  formatAge,
  formatCompact,
  formatUsd,
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

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
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

function RangeBar({ pos }: { pos: number }) {
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
}: {
  launchpadName: string;
  tokens: TokenRow[];
}) {
  const [tab, setTab] = useState<TabId>("trending");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("volume24hUsd");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = tokens.filter((t) => {
      if (!query) return true;
      return (
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
      );
    });

    // tab presets (frontend ranking on draft seed)
    if (tab === "gainers") {
      list = [...list].sort((a, b) => b.change24hPct - a.change24hPct);
    } else if (tab === "new") {
      list = [...list].sort((a, b) => a.ageHours - b.ageHours);
    } else if (tab === "top") {
      list = [...list].sort((a, b) => b.fdvUsd - a.fdvUsd);
    } else {
      // trending ~ vol * |change|
      list = [...list].sort(
        (a, b) =>
          b.volume24hUsd * (1 + Math.abs(b.change24hPct) / 100) -
          a.volume24hUsd * (1 + Math.abs(a.change24hPct) / 100),
      );
    }

    // manual column sort overrides tab order when user clicks
    list = [...list].sort((a, b) => {
      const d = (a[sort] as number) - (b[sort] as number);
      return asc ? d : -d;
    });

    return list;
  }, [tokens, q, tab, sort, asc]);

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
            />
          </label>
        </div>
      </div>

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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="vs-empty">
                  No draft tokens match.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const up = t.change24hPct >= 0;
                const h = hue(t.symbol);
                return (
                  <tr key={t.id} className="vs-row">
                    <td className="col-name">
                      <span
                        className="token-avatar"
                        style={{
                          background: `linear-gradient(145deg, hsl(${h} 72% 48%), hsl(${(h + 36) % 360} 50% 26%))`,
                        }}
                      >
                        {initials(t.symbol)}
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
                          {t.draft ? <span className="draft-pill">draft</span> : null}
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="stack">
                        <span className="num">{formatUsd(t.priceUsd)}</span>
                        <span className={up ? "pct up" : "pct down"}>
                          {up ? "+" : ""}
                          {t.change24hPct.toFixed(2)}%
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
                        <span
                          className={
                            t.holdersDelta24h >= 0 ? "pct up" : "pct down"
                          }
                        >
                          {t.holdersDelta24h >= 0 ? "+" : ""}
                          {t.holdersDelta24h}
                        </span>
                      </div>
                    </td>
                    <td className="col-buy">
                      <button type="button" className="buy-btn" aria-label={`Buy ${t.symbol}`} disabled>
                        ⚡
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="vs-note">
        {launchpadName} launches · {tokensDisclaimer}
      </p>
    </section>
  );
}
