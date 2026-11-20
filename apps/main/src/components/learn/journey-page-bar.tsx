"use client";

import { LearnPageBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

/** `listed`: a learner's sidebar lists the page, so from `lg` it has no way back. */
export function JourneyPageBar({
  children,
  listed = false,
  root = false,
  title,
}: {
  /** The page's own actions, such as its "…". */
  children?: React.ReactNode;
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
      >
        {children}
      </LearnPageBar>
    );
  }

  return <LearnPageBar back={{ href: "/plan", label: t("Plan") }} />;
}
