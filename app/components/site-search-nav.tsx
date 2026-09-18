"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";

/**
 * Search + site nav share the old search-bar width.
 *
 * Jelly-segmented highlight:
 *   0ms     pill is under the current item (layoutId)
 *   travel  spring slide; fill leans + stretches on the travel axis
 *   settle  scale/skew return to rest
 *
 * Reduced motion: jump, no lean/stretch.
 */
const NAV = [
  {
    href: "/",
    label: "Screener",
    match: (p: string) => p === "/",
  },
  {
    href: "/feed",
    label: "Twitter Feed",
    short: "Twitter",
    match: (p: string) => p === "/feed" || p.startsWith("/feed/"),
  },
  {
    href: "/quotes",
    label: "RWA Tokens",
    short: "RWA",
    match: (p: string) => p === "/quotes" || p.startsWith("/quotes/"),
  },
] as const;

const SLIDE = {
  type: "spring" as const,
  stiffness: 280,
  damping: 22,
  mass: 0.72,
};

const JELLY = {
  stretch: 1.18,
  leanDeg: 10,
  settle: {
    type: "spring" as const,
    stiffness: 280,
    damping: 18,
    mass: 0.55,
  },
};

/** Survives page remounts so lean/stretch still know travel direction. */
let lastNavIndex = -1;

export function SiteSearchNav({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const path = usePathname() || "/";
  const reduced = useReducedMotion();
  const scaleX = useMotionValue(1);
  const skewX = useMotionValue(0);
  const activeIndex = NAV.findIndex((n) => n.match(path));

  useEffect(() => {
    const to = activeIndex;
    if (to < 0) return;
    const from = lastNavIndex;
    lastNavIndex = to;
    if (reduced || from < 0 || from === to) {
      scaleX.set(1);
      skewX.set(0);
      return;
    }
    const dir = Math.sign(to - from);
    scaleX.set(JELLY.stretch);
    skewX.set(dir * JELLY.leanDeg);
    const stretch = animate(scaleX, 1, JELLY.settle);
    const lean = animate(skewX, 0, JELLY.settle);
    return () => {
      stretch.stop();
      lean.stop();
    };
  }, [activeIndex, reduced, scaleX, skewX]);

  return (
    <div className="site-chrome">
      <label className="search search-list">
        <SearchIcon />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          aria-label={ariaLabel}
        />
        {value ? (
          <button
            type="button"
            className="ext"
            aria-label="Clear search"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </label>
      <nav className="site-nav" aria-label="Site">
        {NAV.map((item, i) => {
          const current = i === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                current ? "site-nav-item is-current" : "site-nav-item"
              }
              aria-current={current ? "page" : undefined}
            >
              {current ? (
                <motion.span
                  layoutId="site-nav-pill"
                  className="site-nav-pill"
                  transition={reduced ? { duration: 0 } : SLIDE}
                  aria-hidden
                >
                  <motion.span
                    className="site-nav-pill-fill"
                    style={{ scaleX, skewX }}
                  />
                </motion.span>
              ) : null}
              <span className="site-nav-label">
                {"short" in item ? (
                  <>
                    <span className="site-nav-full">{item.label}</span>
                    <span className="site-nav-short">{item.short}</span>
                  </>
                ) : (
                  item.label
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
