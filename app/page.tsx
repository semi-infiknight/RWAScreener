import seed from "../data/projects.json";
import { ProjectFilters } from "./project-filters";

export type Project = (typeof seed.projects)[number];

export default function HomePage() {
  return (
    <main>
      <h1>DBC ecosystem</h1>
      <p className="lede">
        Which projects have integrated Meteora DBC, what they built, what is live
        vs still integrating, what we verified, and our contact with the team.
      </p>
      <p className="disclaimer">{seed.disclaimer}</p>
      <ProjectFilters projects={seed.projects as Project[]} />
      <p className="foot">
        Static seed · updated {seed.updatedAt} · on-chain quote screener comes later
      </p>
    </main>
  );
}
