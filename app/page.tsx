import { peekHomePadMetrics } from "../lib/pad-summary";
import { peekHomePlatformTokens } from "../lib/platform-tokens";
import { projects } from "../lib/projects";
import { EcosystemExplorer } from "./ecosystem-explorer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [initialMetrics, initialPlatformTokens] = await Promise.all([
    peekHomePadMetrics(),
    peekHomePlatformTokens(),
  ]);
  return (
    <EcosystemExplorer
      projects={projects}
      initialMetrics={initialMetrics}
      initialPlatformTokens={initialPlatformTokens}
    />
  );
}
