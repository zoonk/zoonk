import { type ReactNode } from "react";

/** Every progress chart's plot is this tall, and its box holds the place until it draws. */
export const PROGRESS_CHART_HEIGHT = 220;

/**
 * Gives each progress chart the same accessible container and flex-safe
 * width behavior. Recharts measures the chart from this parent, so every chart
 * should use the same `min-w-0` guard instead of relying on each page to
 * remember it.
 */
export function ProgressChartFigure({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure aria-label={label} className="w-full min-w-0">
      {children}
    </figure>
  );
}

/**
 * The plot's box before the chart draws, as Recharts renders it on the server (an empty box at
 * the chart's size, until it measures its width): a plot that loads later takes its place without
 * moving anything.
 */
export function ProgressChartPlaceholder() {
  return <div className="relative w-full" style={{ height: PROGRESS_CHART_HEIGHT }} />;
}
