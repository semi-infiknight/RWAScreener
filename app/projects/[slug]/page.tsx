import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  allSlugs,
  dbcLabel,
  getProject,
  isScreenerLive,
  projects,
} from "../../../lib/projects";
import { peekPadFeed } from "../../../lib/pad-cache";
import { tokensForLaunchpad, type TokenRow } from "../../../lib/tokens";
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
  // Live pads: SSR-seed last-good Redis padfeed (shared), then client refreshes.
  let tokens: TokenRow[] = tokensForLaunchpad(p.id);
  if (live) {
    const peeked = await peekPadFeed<TokenRow[] | { tokens?: TokenRow[] }>(
      p.id,
      "fast",
    );
    if (Array.isArray(peeked) && peeked.length > 0) {
      tokens = peeked;
    } else if (
      peeked &&
      typeof peeked === "object" &&
      Array.isArray((peeked as { tokens?: TokenRow[] }).tokens) &&
      ((peeked as { tokens: TokenRow[] }).tokens.length > 0)
    ) {
      tokens = (peeked as { tokens: TokenRow[] }).tokens;
    }
  }

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
            <div className="aarna-hero-actions">
              {p.website ? (
                <a
                  className="aarna-visit"
                  href={p.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to App ↗
                </a>
              ) : null}
              {(p.x || p.docs || p.github || p.devX || p.devGithub) ? (
                <div className="aarna-hero-link-pills" aria-label="Links">
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
                  {p.github ? (
                    <a href={p.github} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  ) : null}
                  {p.devX ? (
                    <a href={p.devX} target="_blank" rel="noreferrer">
                      Dev X
                    </a>
                  ) : null}
                  {p.devGithub ? (
                    <a href={p.devGithub} target="_blank" rel="noreferrer">
                      Dev GitHub
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
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
