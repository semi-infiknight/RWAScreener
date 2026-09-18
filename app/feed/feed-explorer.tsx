"use client";

import { useState } from "react";
import { EcosystemFeed, FEED_ABOUT } from "../components/ecosystem-feed";
import { PageHeroHeading } from "../components/page-hero-heading";
import { SiteSearchNav } from "../components/site-search-nav";
import { HeroDark } from "../hero-dark";

export function FeedExplorer() {
  const [query, setQuery] = useState("");

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <PageHeroHeading
          title={
            <>
              <span className="hero-title-brand">Meteora</span>
              <span className="hero-title-light"> Ecosystem feed</span>
            </>
          }
          subline={FEED_ABOUT}
        />
      </section>

      <div className="shell">
        <div className="panel">
          <SiteSearchNav
            value={query}
            onChange={setQuery}
            ariaLabel="Search feed"
          />
        </div>
        <EcosystemFeed eager hideHeader />
      </div>
    </div>
  );
}
