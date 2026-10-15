"use client";

import { useSyncExternalStore } from "react";
import { ProgressChartPlaceholder } from "../_components/progress-chart-figure";
import { type SerializedScoreDataPoint } from "./score-chart";
import { scoreChartPlot } from "./score-chart-code";

/**
 * Whether the page shows the plot now: where `media` matches, every width without one. False on
 * the server and while hydrating, since the server can't know the screen.
 */
function useShown(media = "all") {
  const subscribe = (onChange: () => void) => {
    const query = globalThis.matchMedia(media);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  };

  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(media).matches,
    () => false,
  );
}

/**
 * Score's trend plot (Recharts), whose code loads on its own, so a page that doesn't show it never
 * downloads it. It draws at once when the code is already here. Until then (and on the server and
 * while hydrating) its box holds the place, as Recharts' own server render does, so nothing moves.
 * It never waits behind a Suspense fallback: React keeps a fallback once shown for 300 ms at least.
 */
export function OnDemandScoreChartPlot({
  dataPoints,
  media,
}: {
  dataPoints: SerializedScoreDataPoint[];
  /** Where the page shows the plot; elsewhere its code never loads. Every width without one. */
  media?: string;
}) {
  const plot = scoreChartPlot.useModule({ enabled: useShown(media) });

  return plot ? <plot.ScoreChartPlot dataPoints={dataPoints} /> : <ProgressChartPlaceholder />;
}
