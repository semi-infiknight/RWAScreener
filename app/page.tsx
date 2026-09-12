import { projects } from "../lib/projects";
import { EcosystemExplorer } from "./ecosystem-explorer";

export default function HomePage() {
  return (
    <EcosystemExplorer projects={projects} />
  );
}
