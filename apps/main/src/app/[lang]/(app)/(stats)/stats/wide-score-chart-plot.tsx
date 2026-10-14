"use client";

import { useSyncExternalStore } from "react";
import { ProgressChartPlaceholder } from "../_components/progress-chart-figure";
import { LazyScoreChartPlot } from "../score/lazy-score-chart-plot";
import { type SerializedScoreDataPoint } from "../score/score-chart";
import { preloadScoreChart } from "../score/score-chart-preload";

/** Where the overview shows Score's trend (its `md:grid`): Tailwind's `md`. */
const WIDE_QUERY = "(min-width: 48rem)";

// On a wide screen the chart's code starts loading as soon as the overview's code runs, while the
// page hydrates, instead of after: the chart draws sooner, and Score opens with it.
if ("matchMedia" in globalThis && globalThis.matchMedia(WIDE_QUERY).matches) {
  preloadScoreChart();
}

function subscribeToWideQuery(onChange: () => void) {
  const query = globalThis.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Score's trend on the overview, which shows it only from `md` (a phone gets the patterns row
 * instead): the chart's code loads only there, so a phone never downloads or draws it. It's false
 * on the server and while hydrating, and until the chart draws, its box holds the place, as
 * Recharts' own server render does, so nothing moves.
 */
export function WideScoreChartPlot({ dataPoints }: { dataPoints: SerializedScoreDataPoint[] }) {
  const isWide = useSyncExternalStore(
    subscribeToWideQuery,
    () => globalThis.matchMedia(WIDE_QUERY).matches,
    () => false,
  );

  return isWide ? <LazyScoreChartPlot dataPoints={dataPoints} /> : <ProgressChartPlaceholder />;
}
