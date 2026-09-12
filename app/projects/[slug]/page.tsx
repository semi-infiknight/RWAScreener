import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allSlugs,
  dbcLabel,
  disclaimer,
  domainOf,
  getProject,
  projects,
  updatedAt,
} from "../../../lib/projects";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return { title: "Project — RWAScreener" };
  return {
    title: `${p.displayName} — RWAScreener`,
    description: p.summary,
  };
}

const AVATAR_COLORS = [
  "#ff6a00",
  "#ff8a1a",
  "#ffb347",
  "#e85d04",
  "#f48c06",
  "#dc2f02",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();

  const idx = projects.findIndex((x) => x.id === p.id);
  const color = AVATAR_COLORS[Math.max(0, idx) % AVATAR_COLORS.length];
  const others = projects.filter((x) => x.id !== p.id).slice(0, 5);

  return (
    <div className="page">
      <main className="shell project-page">
        <Link href="/" className="back-link">
          ← Ecosystem
        </Link>

        <div className="project-hero">
          <span className="avatar project-avatar" style={{ background: color }}>
            {initials(p.displayName)}
          </span>
          <div>
            <h1>{p.displayName}</h1>
            <p className="domain">{domainOf(p.website)}</p>
            <div className="tags project-tags">
              <span className="tag">{p.status.replace("_", " ")}</span>
              <span className="tag">{dbcLabel(p)}</span>
              <span className="tag">contact: {p.contact}</span>
            </div>
          </div>
        </div>

        <p className="project-summary">{p.summary}</p>

        {p.built.length > 0 ? (
          <section className="project-section">
            <h2>What they built</h2>
            <ul>
              {p.built.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="project-section">
          <h2>Verification</h2>
          <table className="meta-table">
            <tbody>
              <tr>
                <th>Status</th>
                <td>{p.status.replace("_", " ")}</td>
              </tr>
              <tr>
                <th>Contact</th>
                <td>{p.contact}</td>
              </tr>
              <tr>
                <th>DBC</th>
                <td>{p.dbc.evidence}</td>
              </tr>
              <tr>
                <th>Verified</th>
                <td>{p.verified.length ? p.verified.join(", ") : "—"}</td>
              </tr>
              {p.notes ? (
                <tr>
                  <th>Notes</th>
                  <td>{p.notes}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="project-section">
          <h2>Links</h2>
          <div className="expand-links">
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer">
                Website ↗
              </a>
            ) : null}
            {p.x ? (
              <a href={p.x} target="_blank" rel="noreferrer">
                X ↗
              </a>
            ) : null}
            {p.docs ? (
              <a href={p.docs} target="_blank" rel="noreferrer">
                Docs ↗
              </a>
            ) : null}
            {p.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.label} ↗
              </a>
            ))}
          </div>
        </section>

        {others.length > 0 ? (
          <section className="project-section">
            <h2>Other launchpads</h2>
            <div className="other-list">
              {others.map((o) => (
                <Link
                  key={o.id}
                  href={`/projects/${o.slug}`}
                  className="other-row"
                >
                  <span>{o.displayName}</span>
                  <span className="domain">{o.status.replace("_", " ")}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <p className="disclaimer">
          {disclaimer} Updated {updatedAt}.
        </p>
      </main>
    </div>
  );
}
