"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

export function JourneyPageBar({ root = false, title }: { root?: boolean; title?: string }) {
  const t = useExtracted();

  if (root) {
    return <LearnPageBar back={{ href: "/plan" }} root title={title} />;
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
