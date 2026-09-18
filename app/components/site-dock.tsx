"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function itemClass(current: boolean): string {
  return current ? "footer-cta-secondary is-current" : "footer-cta-secondary";
}

export function SiteDock() {
  const path = usePathname() || "/";
  const onHome = path === "/";
  const onFeed = path === "/feed" || path.startsWith("/feed/");
  const onQuotes = path === "/quotes" || path.startsWith("/quotes/");

  return (
    <nav className="footer-cta" aria-label="Site">
      <div className="footer-cta-dock">
        {!onHome ? (
          <Link href="/" className={itemClass(false)}>
            Screener
          </Link>
        ) : null}
        <Link
          href="/feed"
          className={itemClass(onFeed)}
          aria-current={onFeed ? "page" : undefined}
        >
          Feed
        </Link>
        <Link
          href="/quotes"
          className={itemClass(onQuotes)}
          aria-current={onQuotes ? "page" : undefined}
        >
          RWA Tokens
        </Link>
        <a
          className="footer-cta-primary"
          href="https://docs.meteora.ag/core-products/dbc/what-is-dbc"
          target="_blank"
          rel="noreferrer"
        >
          Build on Meteora DBC →
        </a>
      </div>
    </nav>
  );
}
