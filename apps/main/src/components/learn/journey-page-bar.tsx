"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

/** `title` names the page for a way back to it; a page that draws its own bar later names itself. */
export function JourneyPageBar({ root = false, title }: { root?: boolean; title?: string }) {
  const t = useExtracted();

  if (root) {
    return <LearnPageBar back={{ href: "/plan" }} root title={title} />;
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
