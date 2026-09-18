import type { Metadata } from "next";
import { FeedExplorer } from "./feed-explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meteora Ecosystem feed — RWAScreener",
  description:
    "Realtime feed of projects building on Meteora DBC (non-curated).",
};

export default function FeedPage() {
  return <FeedExplorer />;
}
