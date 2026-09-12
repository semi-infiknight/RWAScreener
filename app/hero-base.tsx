"use client";

import HeroBackground from "@/lib/base-hero/Background";

const heroBackgroundConfig = {
  imageUrl: "/base-hero/ecosystem.webp",
  altPattern: {
    url: "/base-hero/pat-colorful.png",
    columns: 6,
  },
  className: "h-full w-full",
  style: {
    width: "100%",
    height: "100%",
  },
  enableInteractivity: true,
  velocityDissipation: 0.94,
  radius: 0.25,
  bottomFade: true,
  darkMode: false,
};

/** Base.org EcosystemHero WebGL background (R3F + fluid/ASCII). */
export function HeroBase() {
  return (
    <div className="hero-canvas-wrap hero-base-wrap" aria-hidden="true">
      <HeroBackground config={heroBackgroundConfig} />
    </div>
  );
}
