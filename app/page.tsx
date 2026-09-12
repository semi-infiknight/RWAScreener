import { projects, disclaimer, updatedAt } from "../lib/projects";
import { EcosystemExplorer } from "./ecosystem-explorer";

export default function HomePage() {
  return (
    <EcosystemExplorer
      projects={projects}
      disclaimer={disclaimer}
      updatedAt={updatedAt}
    />
  );
}
