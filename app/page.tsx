import seed from "../data/projects.json";
import { EcosystemExplorer } from "./ecosystem-explorer";

export type Project = (typeof seed.projects)[number];

export default function HomePage() {
  return (
    <EcosystemExplorer
      projects={seed.projects as Project[]}
      disclaimer={seed.disclaimer}
      updatedAt={seed.updatedAt}
    />
  );
}
