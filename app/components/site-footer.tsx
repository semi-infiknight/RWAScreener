/** Quiet DBC/launch + Agents + one ecosystem X — no site-nav echo, no LP pages. */
const COLUMNS = [
  {
    label: "DBC",
    links: [
      {
        href: "https://docs.meteora.ag/core-products/dbc/what-is-dbc",
        label: "What is DBC",
      },
      {
        href: "https://docs.meteora.ag/developer-guides/dbc",
        label: "Integration",
      },
    ],
  },
  {
    label: "Agents",
    links: [
      {
        href: "https://docs.meteora.ag/agents/overview",
        label: "Overview",
      },
      {
        href: "https://docs.meteora.ag/agents/skill",
        label: "Skill",
      },
      {
        href: "https://docs.meteora.ag/agents/mcp",
        label: "Docs MCP",
      },
      {
        href: "https://docs.meteora.ag/agents/llms-txt",
        label: "llms.txt",
      },
    ],
  },
  {
    label: "Ecosystem",
    links: [
      {
        href: "https://x.com/MeteoraEco",
        label: "@MeteoraEco",
      },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-inner" aria-label="DBC, Agents, and ecosystem">
        {COLUMNS.map((col) => (
          <section key={col.label} className="site-footer-col">
            <h2 className="site-footer-label">{col.label}</h2>
            <ul className="site-footer-links">
              {col.links.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </footer>
  );
}
