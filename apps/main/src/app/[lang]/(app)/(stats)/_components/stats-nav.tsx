"use client";

import { SectionNav } from "@/components/learn/section-nav";
import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";
import { preloadScoreChart } from "../score/score-chart-preload";

/**
 * The overview, then each stat's page, as tabs under the section's title from a tablet up.
 * Reaching for the overview's or Score's tab starts loading Score's chart, which both draw.
 */
export function StatsNav() {
  const t = useExtracted();

  return (
    <SectionNav
      items={[
        { label: t("Overview"), onIntent: preloadScoreChart, url: getMenu("stats").url },
        { label: t("Level"), url: getMenu("level").url },
        { label: t("Energy"), url: getMenu("energy").url },
        { label: t("Activity"), url: getMenu("activity").url },
        { label: t("Score"), onIntent: preloadScoreChart, url: getMenu("score").url },
        { label: t("Patterns"), url: getMenu("patterns").url },
      ]}
      label={t("Your stats")}
    />
  );
}
