"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroDark } from "../hero-dark";

type Quote = {
  mint: string;
  symbol: string;
  name: string;
  logo?: string | null;
  category?: string | null;
  pool_count: number;
};

const AVATAR_COLORS = [
  "#ff6a00",
  "#ff8a1a",
  "#ffb347",
  "#e85d04",
  "#f48c06",
  "#dc2f02",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const CATEGORY_LABELS: Record<string, string> = {
  xstocks: "xStocks",
  ondo: "Ondo",
  backpack: "Backpack",
  commodities: "Commodities",
  other: "Other",
};

function quoteCategoryKey(q: Quote): string {
  const raw = (q.category || "").trim().toLowerCase();
  if (raw) return raw;
  return "other";
}

function quoteCategoryLabel(key: string): string {
  const k = (key || "other").toLowerCase();
  if (CATEGORY_LABELS[k]) return CATEGORY_LABELS[k];
  return k
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Prefer xStocks first, then alpha by label. */
function categorySortKey(key: string): string {
  if (key === "xstocks") return "0";
  if (key === "other") return "zz";
  return `1-${quoteCategoryLabel(key).toLowerCase()}`;
}

export function QuotesExplorer() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  /** Explicit open/closed overrides; unset keys use defaults (xstocks open). */
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setQuotes(body.quotes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredQuotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((row) => {
      const cat = quoteCategoryKey(row);
      const label = quoteCategoryLabel(cat).toLowerCase();
      return (
        row.symbol.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.mint.toLowerCase().includes(q) ||
        cat.includes(q) ||
        label.includes(q)
      );
    });
  }, [quotes, query]);

  const quoteCategories = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const row of filteredQuotes) {
      const key = quoteCategoryKey(row);
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort(
      (a, b) =>
        categorySortKey(a[0]).localeCompare(categorySortKey(b[0])) ||
        quoteCategoryLabel(a[0]).localeCompare(quoteCategoryLabel(b[0])),
    );
  }, [filteredQuotes]);

  function isCategoryOpen(key: string): boolean {
    if (key in openCategories) return openCategories[key]!;
    return key === "xstocks";
  }

  function toggleCategory(key: string) {
    setOpenCategories((prev) => {
      const currentlyOpen =
        key in prev ? Boolean(prev[key]) : key === "xstocks";
      return { ...prev, [key]: !currentlyOpen };
    });
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
              <span className="hero-title-light">DBC </span>
              <span className="hero-title-brand">Quotes</span>
            </span>
          </h1>
          <p className="hero-sub">badged quote mints on Meteora DBC</p>
        </div>
      </section>

      <div className="shell">
        <div className="panel">
          <label className="search search-list">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search quotes"
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
          {error ? <div className="empty">Error: {error}</div> : null}
          {loading ? (
            <div className="empty">Loading…</div>
          ) : quotes.length === 0 ? (
            <div className="empty">No quote tokens yet.</div>
          ) : quoteCategories.length === 0 ? (
            <div className="empty">No quotes match.</div>
          ) : (
            <div className="staging-quote-categories">
              {quoteCategories.map(([catKey, rows]) => {
                const open = isCategoryOpen(catKey);
                const label = quoteCategoryLabel(catKey);
                return (
                  <section
                    key={catKey}
                    className="staging-quote-category"
                    data-category={catKey}
                  >
                    <button
                      type="button"
                      className="staging-quote-cat-toggle"
                      aria-expanded={open}
                      onClick={() => toggleCategory(catKey)}
                    >
                      <span className="staging-quote-cat-chevron" aria-hidden>
                        {open ? "▾" : "▸"}
                      </span>
                      <span className="staging-quote-cat-label">{label}</span>
                      <span className="staging-quote-cat-count">
                        {rows.length}
                      </span>
                    </button>
                    {open ? (
                      <div className="pad-table-wrap">
                        <table
                          className="pad-table vs-table"
                          aria-label={`${label} quotes`}
                        >
                          <thead>
                            <tr>
                              <th>Symbol</th>
                              <th className="hide-sm">Name</th>
                              <th>Coins</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((q, idx) => (
                              <tr key={q.mint} className="vs-row pad-row">
                                <td>
                                  <span className="pad-name-link staging-name-static">
                                    <span
                                      className="avatar"
                                      style={
                                        q.logo
                                          ? undefined
                                          : {
                                              background:
                                                AVATAR_COLORS[
                                                  idx % AVATAR_COLORS.length
                                                ],
                                            }
                                      }
                                    >
                                      {q.logo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={q.logo} alt="" />
                                      ) : (
                                        initials(q.symbol || q.name)
                                      )}
                                    </span>
                                    <span className="identity">
                                      <div className="name">{q.symbol}</div>
                                    </span>
                                  </span>
                                </td>
                                <td className="hide-sm">{q.name}</td>
                                <td className="num">{q.pool_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="footer-cta">
          <a href="/" className="footer-cta-secondary">
            Screener
          </a>
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
