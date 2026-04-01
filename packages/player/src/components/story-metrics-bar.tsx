"use client";

import { type StoryMetric } from "../player-selectors";
import { StoryMetricPill } from "./story-metric-pill";

/**
 * Persistent horizontal bar showing story metrics during gameplay.
 *
 * Renders metrics as compact centered pills that sit between the
 * sticky header and the story content.
 */
export function StoryMetricsBar({ metrics }: { metrics: StoryMetric[] }) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 p-4"
      data-slot="story-metrics-bar"
    >
      {metrics.map((metric) => (
        <StoryMetricPill key={metric.metric} metric={metric.metric} value={metric.value} />
      ))}
    </div>
  );
}
