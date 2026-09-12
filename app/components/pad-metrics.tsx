"use client";

import {
  aggregatePadMetrics,
  type PadAggregate,
} from "../../lib/pad-aggregates";
import { formatUsd, type TokenRow } from "../../lib/tokens";

export type PadMetric = {
  key: string;
  label: string;
  value: string;
};

export type { PadAggregate };

/** Aggregate only from real TokenRow fields — skip a metric if the feed has no data. */
export function computePadMetrics(tokens: TokenRow[]): PadMetric[] {
  if (tokens.length === 0) return [];

  const agg = aggregatePadMetrics(tokens);
  const out: PadMetric[] = [
    {
      key: "coins",
      label: "Coins",
      value: (agg.coins ?? 0).toLocaleString(),
    },
    {
      key: "status-split",
      label: "Bonding / Graduated",
      value: `${(agg.bonding ?? 0).toLocaleString()} / ${(agg.graduated ?? 0).toLocaleString()}`,
    },
  ];

  if (agg.mcapUsd != null) {
    out.push({
      key: "mcap",
      label: "Total mcap",
      value: formatUsd(agg.mcapUsd),
    });
  }
  if (agg.volume24hUsd != null) {
    out.push({
      key: "vol",
      label: "24h volume",
      value: formatUsd(agg.volume24hUsd),
    });
  }
  if (agg.liquidityUsd != null) {
    out.push({
      key: "liq",
      label: "Liquidity",
      value: formatUsd(agg.liquidityUsd),
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
