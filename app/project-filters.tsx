"use client";

import { useMemo, useState } from "react";
import type { Project } from "./page";

const ALL = "all";

export function ProjectFilters({ projects }: { projects: Project[] }) {
  const [status, setStatus] = useState<string>(ALL);
  const filtered = useMemo(
    () =>
      status === ALL ? projects : projects.filter((p) => p.status === status),
    [projects, status],
  );
  const statuses = ["all", "live", "integrating", "in_contact", "discovered"];

  return (
    <>
      <div className="filters" role="tablist" aria-label="Filter by status">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className="filter"
            data-active={status === s}
            onClick={() => setStatus(s)}
          >
            {s}
            {s !== ALL
              ? ` (${projects.filter((p) => p.status === s).length})`
              : ` (${projects.length})`}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.map((p) => (
          <article key={p.id} className="card">
            <div className="card-head">
              <div>
                <h2>{p.displayName}</h2>
                <div className="meta">
                  {p.slug}
                  {p.dbc.integrated === true
                    ? " · DBC yes"
                    : p.dbc.integrated === false
                      ? " · DBC unverified"
                      : " · DBC unknown"}
                  {" · contact: "}
                  {p.contact}
                </div>
              </div>
              <span className={`badge ${p.status}`}>{p.status}</span>
            </div>
            <p className="meta" style={{ margin: 0 }}>
              {p.summary}
            </p>
            {p.built.length > 0 ? (
              <ul className="built">
                {p.built.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {p.verified.length > 0 ? (
              <div className="chips" aria-label="Verified">
                {p.verified.map((v) => (
                  <span key={v} className="chip">
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="notes">Nothing verified yet.</p>
            )}
            <div className="links">
              {p.website ? (
                <a href={p.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
              {p.x ? (
                <a href={p.x} target="_blank" rel="noreferrer">
                  X
                </a>
              ) : null}
              {p.docs ? (
                <a href={p.docs} target="_blank" rel="noreferrer">
                  Docs
                </a>
              ) : null}
              {p.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              ))}
            </div>
            {p.notes ? <p className="notes">{p.notes}</p> : null}
          </article>
        ))}
      </div>
    </>
  );
}
