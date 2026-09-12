"use client";

import { useMemo, useState } from "react";
import {
  formatAge,
  formatUsd,
  tokensDisclaimer,
  type TokenRow,
} from "../../lib/tokens";

type SortKey = "mcapUsd" | "volume24hUsd" | "change24hPct" | "ageHours";
type FilterId = "all" | "bonding" | "graduated";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bonding", label: "Bonding" },
  { id: "graduated", label: "Graduated" },
];

function initials(sym: string) {
  return sym.slice(0, 2).toUpperCase();
}

function hue(sym: string) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
  return h;
}

export function TokenScreener({
  launchpadName,
  tokens,
}: {
  launchpadName: string;
  tokens: TokenRow[];
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortKey>("mcapUsd");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = tokens.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!query) return true;
      return (
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
      );
    });
    list = [...list].sort((a, b) => {
      const d = (a[sort] as number) - (b[sort] as number);
      return asc ? d : -d;
    });
    return list;
  }, [tokens, q, filter, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(false);
    }
  };

  return (
    <section className="screener" aria-label={`${launchpadName} token screener`}>
      <div className="screener-head">
        <div>
          <h2>Tokens</h2>
          <p className="screener-sub">
            Launched via {launchpadName} · draft seed UI
          </p>
        </div>
        <label className="screener-search">
          <span className="sr-only">Search tokens</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol or name"
          />
        </label>
      </div>

      <div className="screener-pills" role="tablist" aria-label="Token status">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="pill"
            data-active={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="screener-table-wrap">
        <table className="screener-table">
          <thead>
            <tr>
              <th className="col-token">Token</th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort("mcapUsd")}>
                  Mcap {sort === "mcapUsd" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="hide-sm">Price</th>
              <th>
                <button type="button" className="sort-btn" onClick={() => toggleSort("change24hPct")}>
                  24h {sort === "change24hPct" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="hide-sm">
                <button type="button" className="sort-btn" onClick={() => toggleSort("volume24hUsd")}>
                  Vol {sort === "volume24hUsd" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th className="hide-sm">
                <button type="button" className="sort-btn" onClick={() => toggleSort("ageHours")}>
                  Age {sort === "ageHours" ? (asc ? "↑" : "↓") : ""}
                </button>
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="screener-empty">
                  No draft tokens match.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const up = t.change24hPct >= 0;
                const h = hue(t.symbol);
                return (
                  <tr key={t.id} className="screener-row">
                    <td className="col-token">
                      <span
                        className="token-avatar"
                        style={{
                          background: `linear-gradient(145deg, hsl(${h} 70% 48%), hsl(${(h + 40) % 360} 55% 28%))`,
                        }}
                      >
                        {initials(t.symbol)}
                      </span>
                      <span className="token-id">
                        <span className="token-sym">${t.symbol}</span>
                        <span className="token-name">{t.name}</span>
                      </span>
                    </td>
                    <td className="num">{formatUsd(t.mcapUsd)}</td>
                    <td className="num hide-sm">{formatUsd(t.priceUsd)}</td>
                    <td className={up ? "num up" : "num down"}>
                      {up ? "+" : ""}
                      {t.change24hPct.toFixed(2)}%
                    </td>
                    <td className="num hide-sm">{formatUsd(t.volume24hUsd)}</td>
                    <td className="num hide-sm">{formatAge(t.ageHours)}</td>
                    <td>
                      <span className="token-status" data-status={t.status}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="screener-note">{tokensDisclaimer}</p>
    </section>
  );
}
