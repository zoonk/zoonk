"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

export function JourneyPageBar({ root = false }: { root?: boolean }) {
  const t = useExtracted();

  if (root) {
    return <LearnPageBar back={{ href: "/plan" }} root />;
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
