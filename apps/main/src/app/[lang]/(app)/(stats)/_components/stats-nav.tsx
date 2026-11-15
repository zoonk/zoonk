"use client";

import { SectionNav } from "@/components/learn/section-nav";
import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";
import { useStatsPages } from "./stats-pages";

export function StatsNav() {
  const t = useExtracted();
  const pages = useStatsPages();

  return (
    <SectionNav
      items={[
        { label: t("Overview"), url: getMenu("stats").url },
        ...pages.map((page) => ({ label: page.label, url: getMenu(page.menu).url })),
      ]}
      label={t("Your stats")}
    />
  );
}
