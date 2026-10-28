"use client";

import { runWhenIdle } from "@/lib/run-when-idle";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { importScoreChartPlot, preloadScoreChart } from "./score-chart-code";

function NoPlot() {
  return null;
}

/** Rendering a dynamic import on the server makes Next's HTML fetch its code, so Score has it by hydration. */
const ScoreChartCodeHint = dynamic(
  () =>
    importScoreChartPlot(() => import("./score-chart-plot")).then(
      () => NoPlot,
      () => NoPlot,
    ),
  { loading: NoPlot },
);

export function ScoreChartPreload({ media }: { media?: string }) {
  const shownHere = "matchMedia" in globalThis && (!media || globalThis.matchMedia(media).matches);

  // During render, not in an effect: the page's first frame already has the chart's code coming.
  if (shownHere) {
    preloadScoreChart();
  }

  useEffect(() => {
    if (!shownHere) {
      return runWhenIdle(preloadScoreChart);
    }
  }, [shownHere]);

  return media ? null : <ScoreChartCodeHint />;
}
