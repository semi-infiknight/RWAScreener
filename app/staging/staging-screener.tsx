"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HeroDark } from "../hero-dark";

type Tab = "launches" | "launchpads" | "quotes";

type Meta = {
  source: string;
  generated_at: string | null;
  cutoff_iso: string;
  allowlist_count: number;
  count: number;
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
  status: string;
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
  pool_count: number;
  last_launch_at: string | null;
};

function shortPk(pk: string | null | undefined, n = 4): string {
  if (!pk) return "—";
  if (pk.length <= n * 2 + 1) return pk;
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
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

export function StagingScreener() {
  const [tab, setTab] = useState<Tab>("launches");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [launchpads, setLaunchpads] = useState<Launchpad[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

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
      setMeta({
        source: body.source,
        generated_at: body.generated_at,
        cutoff_iso: body.cutoff_iso,
        allowlist_count: body.allowlist_count,
        count: body.count,
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

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <div className="hero-lockup">
          <div className="staging-badge" aria-label="Staging">
            STAGING · on-chain DBC indexer
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
                ["launches", "Launches"],
                ["launchpads", "Launchpads"],
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
                onClick={() => setTab(id)}
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
                rows <strong>{meta.count}</strong>
              </span>
              <span>allowlist {meta.allowlist_count}</span>
            </div>
          ) : null}
        </div>

        <div className="panel">
          {error ? <div className="empty">Error: {error}</div> : null}
          {loading ? (
            <div className="empty">Loading…</div>
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
                        <td className="hide-md">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === "launchpads" ? (
            launchpads.length === 0 ? (
              <div className="empty">No launchpads yet.</div>
            ) : (
              <div className="pad-table-wrap">
                <table className="pad-table vs-table" aria-label="Launchpads">
                  <thead>
                    <tr>
                      <th className="col-name">Launchpad</th>
                      <th>Pools</th>
                      <th className="hide-sm">Configs</th>
                      <th className="hide-sm">Quotes</th>
                      <th className="hide-md">Last</th>
                      <th className="hide-lg">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launchpads.map((lp) => (
                      <tr key={lp.fee_claimer} className="vs-row pad-row">
                        <td className="col-name">
                          <div className="name">
                            {lp.label || shortPk(lp.fee_claimer, 6)}
                          </div>
                          <div className="domain mono">
                            {shortPk(lp.fee_claimer, 8)}
                          </div>
                        </td>
                        <td className="num">{lp.pool_count}</td>
                        <td className="num hide-sm">{lp.config_count}</td>
                        <td className="num hide-sm">{lp.quote_mint_count}</td>
                        <td className="hide-md">{fmtTime(lp.last_seen_at)}</td>
                        <td className="hide-lg">
                          {(lp.sample_quote_symbols || []).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : quotes.length === 0 ? (
            <div className="empty">Allowlist empty.</div>
          ) : (
            <div className="pad-table-wrap">
              <table className="pad-table vs-table" aria-label="Quotes">
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
                  {quotes.map((q) => (
                    <tr key={q.mint} className="vs-row pad-row">
                      <td>
                        <div className="name">{q.symbol}</div>
                      </td>
                      <td className="hide-sm">{q.name}</td>
                      <td className="num">{q.pool_count}</td>
                      <td className="hide-md">{fmtTime(q.last_launch_at)}</td>
                      <td className="hide-lg mono">{shortPk(q.mint, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
