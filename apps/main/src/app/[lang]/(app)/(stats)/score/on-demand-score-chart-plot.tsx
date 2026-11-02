"use client";

import { useSyncExternalStore } from "react";
import { ProgressChartPlaceholder } from "../_components/progress-chart-figure";
import { type SerializedScoreDataPoint } from "./score-chart";
import { scoreChartPlot } from "./score-chart-code";

/** False on the server and while hydrating, since the server can't know the screen. */
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
 * A page that doesn't show the plot never downloads it. It never waits behind a Suspense fallback:
 * React keeps a fallback once shown for 300 ms at least.
 */
export function OnDemandScoreChartPlot({
  dataPoints,
  media,
}: {
  dataPoints: SerializedScoreDataPoint[];
  media?: string;
}) {
  const plot = scoreChartPlot.useModule({ enabled: useShown(media) });

  return plot ? <plot.ScoreChartPlot dataPoints={dataPoints} /> : <ProgressChartPlaceholder />;
}
