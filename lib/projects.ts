import seed from "../data/projects.json";

export type Project = (typeof seed.projects)[number];

export const disclaimer = seed.disclaimer;
export const updatedAt = seed.updatedAt;
export const projects = [...(seed.projects as Project[])].sort((a, b) => {
  const ao = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
  const bo = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
  return ao - bo;
});

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug || p.id === slug);
}

export function allSlugs(): string[] {
  return projects.map((p) => p.slug);
}

export function domainOf(website: string | null): string {
  if (!website) return "—";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website;
  }
}

export function dbcLabel(p: Project): string {
  if (p.dbc.integrated === true) return "DBC integrated";
  if (p.dbc.integrated === false) return "DBC not verified";
  if (p.status === "integrating") return "DBC integrating";
  return "DBC TBD";
}

export function isScreenerLive(p: Project): boolean {
  if ("screenerLive" in p && typeof (p as { screenerLive?: boolean }).screenerLive === "boolean") {
    return Boolean((p as { screenerLive?: boolean }).screenerLive);
  }
  return true;
}
