import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allSlugs,
  dbcLabel,
  disclaimer,
  domainOf,
  getProject,
  isScreenerLive,
  projects,
  updatedAt,
} from "../../../lib/projects";
import { tokensForLaunchpad } from "../../../lib/tokens";
import { TokenScreener } from "../../components/token-screener";

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

function statusLiveLabel(status: string): string {
  if (status === "live") return "Now live";
  if (status === "integrating") return "Integrating";
  if (status === "in_contact") return "In contact";
  return "Discovered";
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();

  const idx = projects.findIndex((x) => x.id === p.id);
  const color = AVATAR_COLORS[Math.max(0, idx) % AVATAR_COLORS.length];
  const live = isScreenerLive(p);

  return (
    <div className="page">
      <main className="shell profile-page">
        <div className="profile-topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>›</span>
            <Link href="/">Ecosystem</Link>
            <span aria-hidden>›</span>
            <span>{p.displayName}</span>
          </nav>
          <Link href="/" className="profile-close">
            Close
          </Link>
        </div>

        <div className="profile-layout">
          <aside className="profile-visual" aria-hidden>
            <div
              className="profile-visual-art"
              style={{
                background: `radial-gradient(circle at 50% 42%, ${color} 0%, transparent 42%), linear-gradient(160deg, #1a120c 0%, #0a0a0c 55%, #121014 100%)`,
              }}
            >
              <span className="profile-visual-mark" style={{ background: color }}>
                {initials(p.displayName)}
              </span>
              <span className="profile-live-pill" data-status={p.status}>
                ● {statusLiveLabel(p.status)}
                {p.dbc.integrated === true
                  ? " on DBC"
                  : p.status === "integrating"
                    ? " · DBC"
                    : ""}
              </span>
            </div>
          </aside>

          <div className="profile-body">
            <header className="profile-header">
              <span className="avatar profile-logo" style={{ background: color }}>
                {initials(p.displayName)}
              </span>
              <div className="profile-heading">
                <h1>{p.displayName}</h1>
                <p className="profile-tagline">{p.summary}</p>
              </div>
              {p.website ? (
                <a
                  className="profile-visit"
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit website ↗
                </a>
              ) : null}
            </header>

            <section className="profile-block">
              <h2>About</h2>
              <p>{p.summary}</p>
              {p.notes ? <p className="profile-notes">{p.notes}</p> : null}
            </section>

            <section className="profile-block">
              <h2>Categories</h2>
              <div className="profile-cats">
                <span className="profile-cat">Launchpad</span>
                <span className="profile-cat">{dbcLabel(p)}</span>
                <span className="profile-cat">{p.status.replace("_", " ")}</span>
                {p.ecosystem ? (
                  <span className="profile-cat">{p.ecosystem.name} ecosystem</span>
                ) : null}
              </div>
            </section>

            {p.built.length > 0 ? (
              <section className="profile-block">
                <h2>Features</h2>
                <ul className="profile-features">
                  {p.built.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="profile-card">
              <span className="profile-card-label">Runs on</span>
              <div className="profile-card-value">
                <span className="profile-chip">Solana</span>
                <span className="profile-chip accent">Meteora DBC</span>
              </div>
            </section>

            <section className="profile-card">
              <span className="profile-card-label">Connect</span>
              <div className="profile-connect">
                {p.website ? (
                  <a href={p.website} target="_blank" rel="noreferrer">
                    Website ↗
                  </a>
                ) : null}
                {p.x ? (
                  <a href={p.x} target="_blank" rel="noreferrer">
                    X / Twitter ↗
                  </a>
                ) : null}
                {p.docs ? (
                  <a href={p.docs} target="_blank" rel="noreferrer">
                    Docs ↗
                  </a>
                ) : null}
                {p.ecosystem?.website ? (
                  <a href={p.ecosystem.website} target="_blank" rel="noreferrer">
                    {p.ecosystem.name} ↗
                  </a>
                ) : null}
              </div>
            </section>

            <div className="profile-meta-grid">
              <section className="profile-card">
                <h3>Status</h3>
                <p>
                  <span className="muted">DBC</span>
                  <br />
                  {p.dbc.evidence}
                </p>
              </section>
              <section className="profile-card">
                <h3>Verified</h3>
                <p>
                  {p.verified.length ? p.verified.join(" · ") : "—"}
                  <br />
                  <span className="muted">contact: {p.contact}</span>
                </p>
              </section>
            </div>

            <div className="profile-actions">
              {p.website ? (
                <a
                  className="profile-cta primary"
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Launch app ↗
                </a>
              ) : (
                <span className="profile-cta primary disabled">
                  {live ? "Launch app" : "Not live yet"}
                </span>
              )}
              {p.x ? (
                <a
                  className="profile-cta secondary"
                  href={p.x}
                  target="_blank"
                  rel="noreferrer"
                >
                  Follow ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <TokenScreener
          launchpadName={p.displayName}
          tokens={tokensForLaunchpad(p.id)}
          live={live}
          ecosystemName={p.ecosystem?.name}
        />

        <p className="disclaimer">
          {disclaimer} Updated {updatedAt}. Domain: {domainOf(p.website)}.
        </p>
      </main>
    </div>
  );
}
