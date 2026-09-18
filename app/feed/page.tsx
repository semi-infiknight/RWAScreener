import type { Metadata } from "next";
import { EcosystemFeed } from "../components/ecosystem-feed";
import { SiteDock } from "../components/site-dock";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meteora Ecosystem feed — RWAScreener",
  description:
    "Realtime feed of projects building on Meteora DBC (non-curated).",
};

export default function FeedPage() {
  return (
    <div className="page">
      <div className="shell">
        <EcosystemFeed eager />
        <SiteDock />
      </div>
    </div>
  );
}
