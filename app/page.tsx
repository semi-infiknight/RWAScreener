import { peekHomePadMetrics } from "../lib/pad-summary";
import { peekHomePlatformTokens } from "../lib/platform-tokens";
import { isScreenerLive, projects } from "../lib/projects";
import { EcosystemExplorer } from "./ecosystem-explorer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [initialMetrics, initialPlatformTokens] = await Promise.all([
    peekHomePadMetrics(),
    peekHomePlatformTokens(),
  ]);
  return (
    <EcosystemExplorer
      projects={projects.filter(isScreenerLive)}
      initialMetrics={initialMetrics}
      initialPlatformTokens={initialPlatformTokens}
    />
  );
}
