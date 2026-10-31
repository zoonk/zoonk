"use client";

import { SectionNav } from "@/components/learn/section-nav";
import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";

export function StatsNav() {
  const t = useExtracted();

  return (
    <SectionNav
      items={[
        { label: t("Overview"), url: getMenu("stats").url },
        { label: t("Level"), url: getMenu("level").url },
        { label: t("Energy"), url: getMenu("energy").url },
        { label: t("Activity"), url: getMenu("activity").url },
        { label: t("Score"), url: getMenu("score").url },
        { label: t("Patterns"), url: getMenu("patterns").url },
      ]}
      label={t("Your stats")}
    />
  );
}
