"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "../lib/projects";
import { HeroDark } from "./hero-dark";

const PAGE_SIZE = 15;
const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "integrating", label: "Integrating" },
  { id: "in_contact", label: "In contact" },
  { id: "discovered", label: "Discovered" },
] as const;

const AVATAR_COLORS = [
  "#ff6a00",
  "#ff8a1a",
  "#ffb347",
  "#e85d04",
  "#f48c06",
  "#dc2f02",
];

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

function dbcTag(p: Project): string {
  if (p.dbc.integrated === true) return "DBC";
  if (p.dbc.integrated === false) return "NO DBC YET";
  if (p.status === "integrating") return "DBC integrating";
  return "DBC TBD";
}

export function EcosystemExplorer({
  projects,
  disclaimer,
  updatedAt,
}: {
  projects: Project[];
  disclaimer: string;
  updatedAt: string;
}) {
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
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
  }, [projects, query, status]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <h1>Ecosystem</h1>
        <p>
          DBC launchpads on Solana — what they built, what is live, what we verified.
        </p>
      </section>

      <div className="shell">
        <div className="panel">
        <div className="controls">
          <div className="pills" role="tablist" aria-label="Status filters">
            {STATUS_FILTERS.map((f) => {
              const hideOnMobile =
                f.id !== "all" && f.id !== "live" && f.id !== "discovered";
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`pill${hideOnMobile ? " desktop-only-pills" : ""}`}
                  data-active={status === f.id}
                  onClick={() => {
                    setStatus(f.id);
                    setVisible(PAGE_SIZE);
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Open filters"
            onClick={() => setDrawerOpen(true)}
          >
            <FilterIcon />
          </button>
          <button
            type="button"
            className="icon-btn search-toggle"
            aria-label="Search"
            onClick={() => setMobileSearchOpen((v) => !v)}
          >
            <SearchIcon />
          </button>

          <label className="search">
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
        </div>

        <label
          className="search search-mobile"
          data-open={mobileSearchOpen}
        >
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
        </label>

        <div className="list" role="list">
          {shown.length === 0 ? (
            <div className="empty">No projects match.</div>
          ) : (
            shown.map((p, idx) => {
              const href = p.website ?? p.x ?? p.docs ?? "#";
              return (
                <div key={p.id} role="listitem" className="row-wrap">
                  <Link
                    href={`/projects/${p.slug}`}
                    className="row"
                  >
                    <span
                      className="avatar"
                      style={
                        "icon" in p && p.icon
                          ? undefined
                          : {
                              background:
                                AVATAR_COLORS[idx % AVATAR_COLORS.length],
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
                      <div className="domain">{domainOf(p.website)}</div>
                    </span>
                    <span className="tags">
                      <span className="tag">{p.status.replace("_", " ")}</span>
                      <span className="tag">{dbcTag(p)}</span>
                    </span>
                    <span className="row-chevron" aria-hidden>
                      →
                    </span>
                  </Link>
                  {href !== "#" ? (
                    <a
                      className="ext row-ext"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${p.displayName} website`}
                    >
                      ↗
                    </a>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {visible < filtered.length ? (
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

        <p className="disclaimer">
          {disclaimer} This page lists third-party projects. RWAScreener does
          not offer, recommend, endorse, or provide investment, tax, or legal
          advice. Products are operated by independent parties under their own
          terms. Updated {updatedAt}.
        </p>

        <div className="footer-cta">
          <a href="https://docs.meteora.ag/core-products/dbc/what-is-dbc">
            Learn about DBC →
          </a>
        </div>
      </div>

      <div
        className="drawer-backdrop"
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="drawer" data-open={drawerOpen} aria-hidden={!drawerOpen}>
        <div className="drawer-head">
          <h2>Filters</h2>
          <button
            type="button"
            className="ext"
            aria-label="Close"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="drawer-body">
          <div className="drawer-group">
            <h3>Status</h3>
            <div className="pills">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="pill"
                  data-active={status === f.id}
                  onClick={() => setStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            onClick={() => {
              setStatus("all");
              setQuery("");
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setDrawerOpen(false);
              setVisible(PAGE_SIZE);
            }}
          >
            Apply
          </button>
        </div>
      </aside>
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

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M7 12h10M10 17h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
