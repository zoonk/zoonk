"use client";

import { createSharedImport } from "@/lib/shared-import";
import { type ScoreChartPlot } from "./score-chart-plot";

/** One load of Recharts per tab: the overview's, on a wide screen, is the one Score opens with. */
export const importScoreChartPlot = createSharedImport<{ ScoreChartPlot: typeof ScoreChartPlot }>();

/**
 * Starts loading Score's chart before a page that draws it opens: on intent from links to Score
 * and the overview, which both draw it.
 */
export function preloadScoreChart() {
  void importScoreChartPlot(() => import("./score-chart-plot")).catch(() => null);
}

/** Wraps a link to a page that draws Score's chart: reaching for it starts loading the chart. */
export function ScoreChartIntent({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="contents"
      onFocus={preloadScoreChart}
      onPointerDown={preloadScoreChart}
      onPointerEnter={preloadScoreChart}
    >
      {children}
    </span>
  );
}
