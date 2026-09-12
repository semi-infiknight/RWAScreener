import { peekHomePadMetrics } from "../lib/pad-summary";
import { projects } from "../lib/projects";
import { EcosystemExplorer } from "./ecosystem-explorer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialMetrics = await peekHomePadMetrics();
  return (
    <EcosystemExplorer projects={projects} initialMetrics={initialMetrics} />
  );
}
