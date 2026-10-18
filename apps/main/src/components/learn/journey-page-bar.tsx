"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

/**
 * The bar of a page opened from the Plan while the page loads, or when it has nothing to show
 * (no goal): only its way back, so the page keeps its place and a way out. A page the sidebar
 * lists (`root`: the exam, mind maps) draws it as its loaded bar does, without one from `lg`.
 */
export function JourneyPageBar({ root = false }: { root?: boolean }) {
  const t = useExtracted();

  if (root) {
    return <LearnPageBar back={{ href: "/plan" }} root />;
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
