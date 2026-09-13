"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HeroDark } from "../hero-dark";

type Tab = "launchpads" | "launches" | "quotes";

type Meta = {
  source: string;
  generated_at: string | null;
  cutoff_iso: string;
  allowlist_count: number;
  count: number;
  /** True pool/group total when list is capped (e.g. launches limit=200 of 448). */
  total?: number | null;
};

type Launch = {
  address: string;
  config: string;
  base_mint: string;
  quote_mint: string;
  quote_symbol: string | null;
  fee_claimer: string | null;
  launchpad_label: string | null;
  created_at: string;
  status: "graduated" | "bonding" | "migrating";
};

type Launchpad = {
  fee_claimer: string;
  label: string | null;
  website: string | null;
  pool_count: number;
  config_count: number;
  quote_mint_count: number;
  last_seen_at: string | null;
  sample_quote_symbols: string[];
};

type Quote = {
  mint: string;
  symbol: string;
  name: string;
  category?: string | null;
  pool_count: number;
  last_launch_at: string | null;
};

const AVATAR_COLORS = [
  "#ff6a00",
  "#ff8a1a",
  "#ffb347",
  "#e85d04",
  "#f48c06",
  "#dc2f02",
];

function shortPk(pk: string | null | undefined, n = 4): string {
  if (!pk) return "—";
  if (pk.length <= n * 2 + 1) return pk;
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function domainOf(website: string | null): string {
  if (!website) return "—";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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

export function StagingScreener() {
  const [tab, setTab] = useState<Tab>("launchpads");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [launchpads, setLaunchpads] = useState<Launchpad[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  /** Explicit open/closed overrides; unset keys use defaults (xstocks open). */
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async (active: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const path =
        active === "launches"
          ? "/api/staging/launches?limit=200"
          : active === "launchpads"
            ? "/api/staging/launchpads"
            : "/api/staging/quotes";
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();

      let total: number | null =
        typeof body.total === "number" && Number.isFinite(body.total)
          ? body.total
          : null;

      // Launches list is capped at 200 — pull true pool total from launchpads rollup.
      if (active === "launches" && total == null) {
        const lpRes = await fetch("/api/staging/launchpads", { cache: "no-store" });
        if (lpRes.ok) {
          const lpBody = await lpRes.json();
          const pads = Array.isArray(lpBody.launchpads) ? lpBody.launchpads : [];
          total = pads.reduce(
            (sum: number, lp: { pool_count?: number }) =>
              sum + (typeof lp.pool_count === "number" ? lp.pool_count : 0),
            0,
          );
        }
      }

      if (active === "launchpads") {
        const pads = Array.isArray(body.launchpads) ? body.launchpads : [];
        total = pads.reduce(
          (sum: number, lp: { pool_count?: number }) =>
            sum + (typeof lp.pool_count === "number" ? lp.pool_count : 0),
          0,
        );
      }

      setMeta({
        source: body.source,
        generated_at: body.generated_at,
        cutoff_iso: body.cutoff_iso,
        allowlist_count: body.allowlist_count,
        count: body.count,
        total,
      });
      if (active === "launches") setLaunches(body.launches ?? []);
      if (active === "launchpads") setLaunchpads(body.launchpads ?? []);
      if (active === "quotes") setQuotes(body.quotes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const filteredLaunchpads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return launchpads;
    return launchpads.filter((lp) => {
      const label = (lp.label || "").toLowerCase();
      const fee = lp.fee_claimer.toLowerCase();
      const site = (lp.website || "").toLowerCase();
      const samples = (lp.sample_quote_symbols || []).join(" ").toLowerCase();
      return (
        label.includes(q) ||
        fee.includes(q) ||
        site.includes(q) ||
        samples.includes(q)
      );
    });
  }, [launchpads, query]);

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
      const currentlyOpen = key in prev ? Boolean(prev[key]) : key === "xstocks";
      return { ...prev, [key]: !currentlyOpen };
    });
  }

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <div className="hero-lockup">
          <div className="staging-badge staging-badge-lg" aria-label="Staging">
            Staging
          </div>
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
          <p className="hero-sub">
            stock-quote pools from on-chain index · not the pad-site feed
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="staging-toolbar">
          <Link href="/" className="staging-back">
            ← Ecosystem home
          </Link>
          <div className="staging-tabs" role="tablist">
            {(
              [
                ["launchpads", "Launchpads"],
                ["launches", "Launches"],
                ["quotes", "Quotes"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={
                  tab === id ? "staging-tab staging-tab-active" : "staging-tab"
                }
                onClick={() => {
                  setTab(id);
                  setQuery("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {meta ? (
            <div className="staging-meta">
              <span>
                source <strong>{meta.source}</strong>
              </span>
              <span>
                {meta.total != null && meta.total > meta.count ? (
                  <>
                    showing <strong>{meta.count}</strong> of{" "}
                    <strong>{meta.total}</strong>
                    {tab === "launches" ? " pools" : tab === "launchpads" ? " pools" : ""}
                  </>
                ) : (
                  <>
                    rows <strong>{meta.count}</strong>
                    {tab === "launchpads" && meta.total != null ? (
                      <>
                        {" "}
                        · <strong>{meta.total}</strong> pools
                      </>
                    ) : null}
                  </>
                )}
              </span>
              <span>allowlist {meta.allowlist_count}</span>
            </div>
          ) : null}
        </div>

        {tab === "launchpads" || tab === "quotes" ? (
          <label className="search-list">
            <span className="sr-only">
              {tab === "quotes" ? "Search quotes" : "Search launchpads"}
            </span>
            <input
              type="search"
              placeholder={
                tab === "quotes" ? "Search quotes…" : "Search launchpads…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={
                tab === "quotes" ? "Search quotes" : "Search launchpads"
              }
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
        ) : null}

        <div className="panel">
          {error ? <div className="empty">Error: {error}</div> : null}
          {loading ? (
            <div className="empty">Loading…</div>
          ) : tab === "launchpads" ? (
            filteredLaunchpads.length === 0 ? (
              <div className="empty">
                {launchpads.length === 0
                  ? "No launchpads indexed yet. Empty is honest."
                  : "No launchpads match."}
              </div>
            ) : (
              <div className="pad-table-wrap">
                <table
                  className="pad-table vs-table"
                  aria-label="Staging launchpad metrics"
                >
                  <thead>
                    <tr>
                      <th className="col-name">Name</th>
                      <th>Pools</th>
                      <th className="hide-sm">Configs</th>
                      <th className="hide-sm">Quotes</th>
                      <th className="hide-md">Last</th>
                      <th className="hide-lg">Sample</th>
                      <th className="col-action">App</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLaunchpads.map((lp, idx) => {
                      const name = lp.label || shortPk(lp.fee_claimer, 6);
                      return (
                        <tr key={lp.fee_claimer} className="vs-row pad-row">
                          <td className="col-name">
                            <span className="pad-name-link staging-name-static">
                              <span
                                className="avatar"
                                style={{
                                  background:
                                    AVATAR_COLORS[idx % AVATAR_COLORS.length],
                                }}
                              >
                                {initials(name)}
                              </span>
                              <span className="identity">
                                <div className="name">{name}</div>
                                <div className="domain">
                                  {lp.website
                                    ? domainOf(lp.website)
                                    : shortPk(lp.fee_claimer, 8)}
                                </div>
                              </span>
                            </span>
                          </td>
                          <td className="num">{lp.pool_count.toLocaleString()}</td>
                          <td className="num hide-sm">
                            {lp.config_count.toLocaleString()}
                          </td>
                          <td className="num hide-sm">
                            {lp.quote_mint_count.toLocaleString()}
                          </td>
                          <td className="hide-md">{fmtTime(lp.last_seen_at)}</td>
                          <td className="hide-lg">
                            {(lp.sample_quote_symbols || []).join(", ") || "—"}
                          </td>
                          <td className="col-action">
                            {lp.website ? (
                              <a
                                className="go-to-app go-to-app-table"
                                href={lp.website}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Go to ${name} app`}
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
              </div>
            )
          ) : tab === "launches" ? (
            launches.length === 0 ? (
              <div className="empty">
                No stock-quote launches indexed yet. Empty is honest.
              </div>
            ) : (
              <div className="pad-table-wrap">
                <table className="pad-table vs-table" aria-label="Launches">
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Quote</th>
                      <th>Launchpad</th>
                      <th className="hide-sm">Pool</th>
                      <th className="hide-md">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launches.map((l) => (
                      <tr key={l.address} className="vs-row pad-row">
                        <td>{fmtTime(l.created_at)}</td>
                        <td>
                          <div className="name">
                            {l.quote_symbol || shortPk(l.quote_mint)}
                          </div>
                          <div className="domain mono">
                            {shortPk(l.quote_mint, 6)}
                          </div>
                        </td>
                        <td>
                          {l.launchpad_label || shortPk(l.fee_claimer, 6)}
                        </td>
                        <td className="hide-sm mono">
                          {shortPk(l.address, 6)}
                        </td>
                        <td className="hide-md">
                          <span
                            className={
                              l.status === "graduated"
                                ? "staging-status staging-status-grad"
                                : l.status === "migrating"
                                  ? "staging-status staging-status-migrating"
                                  : "staging-status staging-status-bonding"
                            }
                          >
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : quotes.length === 0 ? (
            <div className="empty">Allowlist empty.</div>
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
                              <th>Pools</th>
                              <th className="hide-md">Last launch</th>
                              <th className="hide-lg">Mint</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((q) => (
                              <tr key={q.mint} className="vs-row pad-row">
                                <td>
                                  <div className="name">{q.symbol}</div>
                                </td>
                                <td className="hide-sm">{q.name}</td>
                                <td className="num">{q.pool_count}</td>
                                <td className="hide-md">
                                  {fmtTime(q.last_launch_at)}
                                </td>
                                <td className="hide-lg mono">
                                  {shortPk(q.mint, 6)}
                                </td>
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
      </div>
    </div>
  );
}
