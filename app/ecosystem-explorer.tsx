"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Project } from "../lib/projects";
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
}: {
  projects: Project[];
}) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

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

  const shown = filtered.slice(0, visible);

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <h1>meteora DBC screener</h1>
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

