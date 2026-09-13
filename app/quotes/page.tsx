import type { Metadata } from "next";
import { QuotesExplorer } from "./quotes-explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quote tokens — RWAScreener",
  description:
    "Badged DBC quote mints grouped by category — stock and RWA quote tokens on Meteora.",
};

export default function QuotesPage() {
  return <QuotesExplorer />;
}
