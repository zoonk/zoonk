"use client";

import dynamic from "next/dynamic";
import { ProgressChartPlaceholder } from "../_components/progress-chart-figure";
import { importScoreChartPlot } from "./score-chart-preload";

/**
 * Score's trend plot, whose code (Recharts) loads on its own, so a page that doesn't draw it
 * never downloads it, even through a link's prefetch. It renders on the server as the chart does
 * (an empty box at its size until it measures its width), and that box holds the place while the
 * code loads, so nothing moves.
 */
export const LazyScoreChartPlot = dynamic(
  () => importScoreChartPlot(() => import("./score-chart-plot")).then((mod) => mod.ScoreChartPlot),
  { loading: () => <ProgressChartPlaceholder /> },
);
