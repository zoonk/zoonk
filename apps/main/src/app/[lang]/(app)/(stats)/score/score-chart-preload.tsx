"use client";

import { runWhenIdle } from "@/lib/run-when-idle";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { importScoreChartPlot, preloadScoreChart } from "./score-chart-code";

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

function NoPlot() {
  return null;
}

/**
 * Draws nothing. Next has the HTML of a page that renders a dynamic import on the server fetch
 * that import's code, so Score opened directly has its chart's code by the time it hydrates. A
 * failed load is the plot's to retry, never an error here.
 */
const ScoreChartCodeHint = dynamic(
  () =>
    importScoreChartPlot(() => import("./score-chart-plot")).then(
      () => NoPlot,
      () => NoPlot,
    ),
  { loading: NoPlot },
);

/**
 * Starts loading Score's chart as a page that draws it opens, before its numbers arrive: at once
 * where the page shows it (`media`; every width without one), so it draws with the page. Elsewhere
 * (the overview on a phone, whose Score tile opens Score) once the page is idle, so Score opens
 * with its chart drawn. A page that shows it at every width also has its HTML fetch the code.
 */
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
