"use client";

import {
  formatUsd,
  type TokenRow,
} from "../../lib/tokens";

export type PadMetric = {
  key: string;
  label: string;
  value: string;
};

/** Aggregate only from real TokenRow fields — skip a metric if the feed has no data. */
export function computePadMetrics(tokens: TokenRow[]): PadMetric[] {
  if (tokens.length === 0) return [];

  const out: PadMetric[] = [
    {
      key: "coins",
      label: "Coins",
      value: tokens.length.toLocaleString(),
    },
  ];

  const bonding = tokens.filter((t) => t.status === "bonding").length;
  const graduated = tokens.filter((t) => t.status === "graduated").length;
  out.push({
    key: "status-split",
    label: "Bonding / Graduated",
    value: `${bonding.toLocaleString()} / ${graduated.toLocaleString()}`,
  });

  const mcaps = tokens
    .map((t) => t.mcapUsd)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (mcaps.length > 0) {
    out.push({
      key: "mcap",
      label: "Total mcap",
      value: formatUsd(mcaps.reduce((a, b) => a + b, 0)),
    });
  }

  const vols = tokens
    .map((t) => t.volume24hUsd)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (vols.length > 0) {
    out.push({
      key: "vol",
      label: "24h volume",
      value: formatUsd(vols.reduce((a, b) => a + b, 0)),
    });
  }

  const liqs = tokens
    .map((t) => t.liquidityUsd)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (liqs.length > 0) {
    out.push({
      key: "liq",
      label: "Liquidity",
      value: formatUsd(liqs.reduce((a, b) => a + b, 0)),
    });
  }

  return out;
}

export function PadMetrics({
  tokens,
  loading = false,
}: {
  tokens: TokenRow[];
  loading?: boolean;
}) {
  const metrics = computePadMetrics(tokens);

  if (loading) {
    return (
      <div className="pad-metrics" aria-busy="true" aria-label="Pad metrics">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pad-metrics-card pad-metrics-skel" />
        ))}
      </div>
    );
  }

  if (metrics.length === 0) return null;

  return (
    <div className="pad-metrics" aria-label="Pad metrics">
      {metrics.map((m) => (
        <div key={m.key} className="pad-metrics-card">
          <p className="pad-metrics-k">{m.label}</p>
          <p className="pad-metrics-v">{m.value}</p>
        </div>
      ))}
    </div>
  );
}
