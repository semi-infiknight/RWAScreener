"use client";

import { LayoutGroup } from "framer-motion";
import type { ReactNode } from "react";

/** Lets the site-nav jelly pill keep layoutId across `/` ↔ `/feed` ↔ `/quotes`. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <LayoutGroup id="site-chrome">{children}</LayoutGroup>;
}
