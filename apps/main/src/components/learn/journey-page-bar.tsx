"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

/**
 * The bar of a page opened from the Journey while the page loads, or when it has nothing to show
 * (no goal): only its way back, so the page keeps its place and a way out.
 */
export function JourneyPageBar() {
  const t = useExtracted();
  return <LearnPageBar back={{ href: "/journey", label: t("Journey") }} />;
}
