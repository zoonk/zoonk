"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

/** `listed`: a learner's sidebar lists the page, so from `lg` it has no way back. */
export function JourneyPageBar({
  listed = false,
  root = false,
  title,
}: {
  listed?: boolean;
  root?: boolean;
  title?: string;
}) {
  const t = useExtracted();

  if (root) {
    return (
      <LearnPageBar
        back={{ href: "/plan" }}
        listed={listed ? "learner" : undefined}
        root
        title={title}
      />
    );
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
