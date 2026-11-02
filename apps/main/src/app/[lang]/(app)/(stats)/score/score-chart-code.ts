import { createSharedImport } from "@/lib/shared-import";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { type ScoreChartPlot } from "./score-chart-plot";

export const importScoreChartPlot = createSharedImport<{ ScoreChartPlot: typeof ScoreChartPlot }>();

export const scoreChartPlot = createOnDemand(() =>
  importScoreChartPlot(() => import("./score-chart-plot")),
);

export function preloadScoreChart() {
  void scoreChartPlot.load();
}
