import type { Metadata } from "next";
import { StagingScreener } from "./staging-screener";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staging · on-chain DBC indexer — RWAScreener",
  description:
    "Staging stock-quote Dynamic Bonding Curve screener. Production pad feeds unchanged.",
};

export default function StagingPage() {
  return <StagingScreener />;
}
