import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categoryLabel, getQuote, getQuoteLaunches } from "@/lib/staging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

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

function shortPk(pk: string, n = 4): string {
  if (pk.length <= n * 2 + 1) return pk;
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
}

function ageLabel(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = ms / 36e5;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 14) return `${Math.round(d)}d`;
  return `${Math.round(d / 7)}w`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const q = await getQuote(slug);
  if (!q) return { title: "Quote — RWAScreener" };
  return {
    title: `${q.symbol} — RWAScreener`,
    description: `${q.name} quote mint on Meteora DBC`,
  };
}

export default async function QuotePage({ params }: Props) {
  const { slug } = await params;
  const q = await getQuote(slug);
  if (!q) notFound();

  const { launches } = await getQuoteLaunches(q.mint, 500);
  const graduated = launches.filter((l) => l.status === "graduated").length;
  const bonding = launches.filter((l) => l.status === "bonding").length;
  const color =
    AVATAR_COLORS[
      Math.abs(q.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
        AVATAR_COLORS.length
    ];
  const cat = categoryLabel(q.category);

  return (
    <div className="page">
      <main className="shell aarna-page">
        <nav className="aarna-crumbs" aria-label="Breadcrumb">
          <Link href="/quotes">Quotes</Link>
          <span aria-hidden>›</span>
          <span>{q.symbol}</span>
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
                q.logo
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
              {q.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.logo}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials(q.symbol || q.name)
              )}
            </span>
          </div>
          <div className="aarna-hero-body">
            <h1>{q.symbol}</h1>
            <p className="aarna-desc">{q.name}</p>
            <div className="aarna-tags">
              <span className="aarna-tag">{cat}</span>
              <span className="aarna-tag">Quote mint</span>
            </div>
          </div>
        </article>

        <div className="pad-metrics" aria-label="Quote metrics">
          <div className="pad-metrics-card">
            <p className="pad-metrics-k">Coins</p>
            <p className="pad-metrics-v">{q.pool_count.toLocaleString()}</p>
          </div>
          <div className="pad-metrics-card">
            <p className="pad-metrics-k">Bonding</p>
            <p className="pad-metrics-v">{bonding.toLocaleString()}</p>
          </div>
          <div className="pad-metrics-card">
            <p className="pad-metrics-k">Graduated</p>
            <p className="pad-metrics-v">{graduated.toLocaleString()}</p>
          </div>
        </div>

        {launches.length === 0 ? (
          <div className="empty">No coins paired with {q.symbol} yet.</div>
        ) : (
          <div className="pad-table-wrap">
            <table className="pad-table vs-table" aria-label={`Coins paired with ${q.symbol}`}>
              <thead>
                <tr>
                  <th className="col-name">Token</th>
                  <th>Pad</th>
                  <th>Status</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {launches.map((l) => (
                  <tr key={l.address} className="vs-row pad-row">
                    <td className="col-name">
                      <span className="identity">
                        <div className="name mono">{shortPk(l.base_mint, 4)}</div>
                      </span>
                    </td>
                    <td>{l.launchpad_label || "—"}</td>
                    <td>
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
                    <td className="num">{ageLabel(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
