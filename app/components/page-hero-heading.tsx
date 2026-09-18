import type { ReactNode } from "react";

/** Shared heading + subline under the persistent search+nav bar. */
export function PageHeroHeading({
  title,
  subline,
}: {
  title: ReactNode;
  subline: ReactNode;
}) {
  return (
    <div className="hero-lockup">
      <h1 className="hero-title">
        <span className="hero-title-text">{title}</span>
      </h1>
      <p className="hero-sub">{subline}</p>
    </div>
  );
}
