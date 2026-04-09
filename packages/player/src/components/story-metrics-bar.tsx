"use client";

import { useExtracted } from "next-intl";
import { type StoryMetric } from "../player-selectors";
import { PlayerContentFrame } from "./step-layouts";
import { StoryMetricPill } from "./story-metric-pill";

/**
 * Persistent horizontal bar showing story metrics during gameplay.
 *
 * Renders metrics as compact centered pills that sit between the
 * sticky header and the story content.
 */
export function StoryMetricsBar({ metrics }: { metrics: StoryMetric[] }) {
  const t = useExtracted();

  if (metrics.length === 0) {
    return null;
  }

  return (
    <PlayerContentFrame
      aria-label={t("Current status")}
      className="flex flex-wrap items-center justify-center gap-2 py-4"
      role="status"
    >
      {metrics.map((metric) => (
        <StoryMetricPill key={metric.metric} metric={metric.metric} value={metric.value} />
      ))}
    </PlayerContentFrame>
  );
}
