"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BUILD_HREF =
  "https://docs.meteora.ag/core-products/dbc/what-is-dbc";

function navClass(pathname: string, href: string) {
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  return active ? "site-header-link is-active" : "site-header-link";
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link href="/" className="site-header-brand" aria-label="Home">
        <span className="mark" aria-hidden />
        <span className="site-header-brand-text">DBC Screener</span>
      </Link>
      <nav className="site-header-nav" aria-label="Site">
        <Link href="/feed" className={navClass(pathname, "/feed")}>
          Feed
        </Link>
        <Link href="/quotes" className={navClass(pathname, "/quotes")}>
          Quotes
        </Link>
        <a
          className="site-header-cta"
          href={BUILD_HREF}
          target="_blank"
          rel="noreferrer"
        >
          Build on Meteora DBC →
        </a>
      </nav>
    </header>
  );
}
