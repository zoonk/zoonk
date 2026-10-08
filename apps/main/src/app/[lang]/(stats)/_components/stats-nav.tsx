"use client";

import { SectionNav } from "@/components/learn/section-nav";
import { getMenu } from "@/lib/menu";
import { useExtracted } from "next-intl";
import { METRIC_TONE, type StatsMetric } from "./stats-metric-tile";

function toPage(key: Parameters<typeof getMenu>[0], label: string, metric?: StatsMetric) {
  return {
    icon: getMenu(key).icon,
    label,
    tone: metric && METRIC_TONE[metric],
    url: getMenu(key).url,
  };
}

/**
 * The overview, then each stat's page beside the page from `lg`, each on its stat's colored tile:
 * the belt first, then Energy and the rest.
 */
export function StatsNav() {
  const t = useExtracted();

  return (
    <SectionNav
      groups={[
        [
          toPage("stats", t("Overview")),
          toPage("level", t("Level"), "level"),
          toPage("energy", t("Energy"), "energy"),
          toPage("activity", t("Activity"), "activity"),
          toPage("score", t("Score"), "score"),
          toPage("patterns", t("Patterns"), "patterns"),
        ],
      ]}
      label={t("Your stats")}
    />
  );
}
