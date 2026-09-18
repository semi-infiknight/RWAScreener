"use client";

import { useState } from "react";
import { EcosystemFeed, FeedAboutHint } from "../components/ecosystem-feed";
import { SiteSearchNav } from "../components/site-search-nav";
import { HeroDark } from "../hero-dark";

export function FeedExplorer() {
  const [query, setQuery] = useState("");

  return (
    <div className="page">
      <section className="hero">
        <HeroDark />
        <div className="hero-lockup">
          <div className="eco-feed-heading-row">
            <h1 className="hero-title eco-feed-title">
              <span className="hero-title-text">
                <span className="hero-title-brand">Meteora</span>
                <span className="hero-title-light"> Ecosystem feed</span>
              </span>
            </h1>
            <FeedAboutHint />
          </div>
        </div>
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
