import { createSharedImport } from "@/lib/shared-import";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { type ScoreChartPlot } from "./score-chart-plot";

/** One load of Recharts per tab, whoever starts it: a page, a link reached for, Score's hint. */
export const importScoreChartPlot = createSharedImport<{ ScoreChartPlot: typeof ScoreChartPlot }>();

/** Score's chart code (Recharts) in its own chunk: a page that has it draws the chart at once. */
export const scoreChartPlot = createOnDemand(() =>
  importScoreChartPlot(() => import("./score-chart-plot")),
);

/**
 * Starts loading Score's chart before a page that draws it needs it: as Score and the overview
 * open, and on intent from links to them.
 */
export function preloadScoreChart() {
  void scoreChartPlot.load();
}
