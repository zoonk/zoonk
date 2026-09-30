"use client";

import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import {
  ActivityPlot,
  ActivityPlotArea,
  ActivityPlotAxisX,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotGuide,
  ActivityPlotLine,
} from "../_components/activity-plot";
import { niceDomain, niceTicks } from "../_utils/plot-scale";
import { type PlotPoint } from "../_utils/sample-formula";

type Variable = ActivityContentFor<"parameterSimulation">["fields"]["variables"][number];

const PLOT_HEIGHT = 176;
const TARGET_DOT_RADIUS = 7;
const Y_TICKS = 3;
const X_TICKS = 4;

/**
 * The plotted output across the x slider's range: the starting curve dashed when another slider
 * has moved, the current curve with a dot where the sliders are, and after the check the
 * expected point (on its own dashed curve when the check holds the other sliders elsewhere).
 */
export function SimulationPlot({
  current,
  curve,
  formatX,
  formatY,
  starting,
  target,
  x,
}: {
  current: PlotPoint | null;
  curve: readonly PlotPoint[];
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  starting: readonly PlotPoint[] | null;
  target: { curve: readonly PlotPoint[] | null; point: PlotPoint } | null;
  x: Variable;
}) {
  const yDomain = niceDomain(
    [
      ...curve,
      ...(starting ?? []),
      ...(target?.curve ?? []),
      ...(target ? [target.point] : []),
    ].map((point) => point.y),
  );

  return (
    <ActivityPlot height={PLOT_HEIGHT} xDomain={[x.min, x.max]} yDomain={yDomain}>
      <ActivityPlotGridY format={formatY} ticks={niceTicks(yDomain, Y_TICKS)} />
      <ActivityPlotAxisX format={formatX} ticks={niceTicks([x.min, x.max], X_TICKS)} />

      <ActivityPlotArea points={curve} />

      {starting && (
        <ActivityPlotLine
          className="stroke-muted-foreground/70 stroke-2 [stroke-dasharray:5_5]"
          points={starting}
        />
      )}

      {target?.curve && (
        <ActivityPlotLine
          className="stroke-success/80 stroke-2 [stroke-dasharray:5_5]"
          points={target.curve}
        />
      )}

      <ActivityPlotLine points={curve} />

      {target && (
        <ActivityPlotDot
          className="fill-success"
          radius={TARGET_DOT_RADIUS}
          x={target.point.x}
          y={target.point.y}
        />
      )}

      {current && (
        <>
          <ActivityPlotGuide x={current.x} y={current.y} />
          <ActivityPlotDot x={current.x} y={current.y} />
        </>
      )}
    </ActivityPlot>
  );
}
