import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allSlugs,
  dbcLabel,
  domainOf,
  getProject,
  isScreenerLive,
  projects,
} from "../../../lib/projects";
import { tokensForLaunchpad } from "../../../lib/tokens";
import { LivePadScreener } from "../../components/live-pad-screener";

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

function statusLabel(status: string): string {
  if (status === "live") return "Live";
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
  const about = [p.summary, p.notes].filter(Boolean).join(" ");
  // Live pads (ethics/ember/…) load tokens client-side via /api/pads/*
  // so soft-nav from the homepage is instant.
  const tokens = tokensForLaunchpad(p.id);

  return (
    <div className="page">
      <main className="shell aarna-page">
        <nav className="aarna-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden>›</span>
          <span>{p.displayName}</span>
        </nav>

        <article className="aarna-hero">
          <div
            className="aarna-banner"
            style={{
              background: `radial-gradient(ellipse 80% 120% at 50% -10%, ${color}55 0%, transparent 55%), linear-gradient(180deg, #16120e 0%, #0e0e0e 100%)`,
            }}
            aria-hidden
          />
          <div className="aarna-hero-top">
            <span
              className="aarna-logo"
              style={
                "icon" in p && p.icon
                  ? {
                      boxShadow: `0 0 0 1px ${color}88, 0 12px 40px rgba(0,0,0,0.45)`,
                      overflow: "hidden",
                      padding: 0,
                    }
                  : {
                      background: `linear-gradient(145deg, ${color}, #1a120c)`,
                      boxShadow: `0 0 0 1px ${color}88, 0 12px 40px rgba(0,0,0,0.45)`,
                    }
              }
            >
              {"icon" in p && p.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initials(p.displayName)
              )}
            </span>
            {p.website ? (
              <a
                className="aarna-visit"
                href={p.website}
                target="_blank"
                rel="noreferrer"
              >
                Visit Website ↗
              </a>
            ) : null}
          </div>

          <div className="aarna-hero-body">
            <h1>{p.displayName}</h1>
            <div className="aarna-tags">
              <span className="aarna-tag">Launchpad</span>
              <span className="aarna-tag">{dbcLabel(p)}</span>
              <span className="aarna-tag">{statusLabel(p.status)}</span>
              {p.ecosystem ? (
                <span className="aarna-tag">{p.ecosystem.name}</span>
              ) : null}
            </div>
            <p className="aarna-desc">{about}</p>
            {p.built.length > 0 ? (
              <ul className="aarna-built">
                {p.built.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>

        <section className="aarna-row">
          <span className="aarna-row-label">Runs on</span>
          <div className="aarna-row-value">
            <span className="aarna-net">
              <span className="aarna-net-dot" aria-hidden />
              Solana
            </span>
            <span className="aarna-net accent">
              <span className="aarna-net-dot accent" aria-hidden />
              Meteora DBC
            </span>
          </div>
        </section>

        <section className="aarna-row aarna-connect">
          <span className="aarna-row-label">Connect</span>
          <div className="aarna-connect-btns">
            {p.x ? (
              <a href={p.x} target="_blank" rel="noreferrer">
                See Twitter/X ↗
              </a>
            ) : null}
            {p.docs ? (
              <a href={p.docs} target="_blank" rel="noreferrer">
                Read Docs ↗
              </a>
            ) : null}
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer">
                Open App ↗
              </a>
            ) : null}
            {p.ecosystem?.website ? (
              <a href={p.ecosystem.website} target="_blank" rel="noreferrer">
                {p.ecosystem.name} ↗
              </a>
            ) : null}
            {!p.x && !p.docs && !p.website && !p.ecosystem?.website ? (
              <span className="aarna-connect-empty">No public links yet</span>
            ) : null}
          </div>
        </section>

        <div className="aarna-meta">
          <section className="aarna-meta-card">
            <h2>Status</h2>
            <p className="aarna-meta-k">DBC</p>
            <p className="aarna-meta-v">{p.dbc.evidence}</p>
          </section>
          <section className="aarna-meta-card">
            <h2>Verified</h2>
            <p className="aarna-meta-k">Sources</p>
            <p className="aarna-meta-v">
              {p.verified.length ? p.verified.join(" · ") : "—"}
            </p>
            <p className="aarna-meta-k" style={{ marginTop: "0.75rem" }}>
              Contact
            </p>
            <p className="aarna-meta-v">{p.contact}</p>
          </section>
        </div>

        <LivePadScreener
          launchpadId={p.id}
          launchpadName={p.displayName}
          initialTokens={tokens}
          live={live}
          ecosystemName={p.ecosystem?.name}
        />
      </main>
    </div>
  );
}
