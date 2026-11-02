import { type ReactNode } from "react";

export const PROGRESS_CHART_HEIGHT = 220;

/** Recharts measures the chart from this parent, which needs `min-w-0` to shrink in a flex row. */
export function ProgressChartFigure({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure aria-label={label} className="w-full min-w-0">
      {children}
    </figure>
  );
}

/** As Recharts renders it on the server, an empty box at the chart's size, so nothing moves when it draws. */
export function ProgressChartPlaceholder() {
  return <div className="relative w-full" style={{ height: PROGRESS_CHART_HEIGHT }} />;
}
