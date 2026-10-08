"use client";

import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { type PlotPoint } from "../_utils/sample-formula";
import {
  ActivityPlot,
  ActivityPlotArea,
  ActivityPlotAxisX,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotGuide,
  ActivityPlotLine,
  usePlotScales,
} from "./activity-plot";

const PLOT_HEIGHT = 168;
const MARK_RADIUS = 4.5;
const EXPECTED_RADIUS = 7;
const DELTA_LABEL_GAP = 8;
const MIN_DELTA_PIXELS = 12;

type Curve = { points: readonly PlotPoint[]; y: number | null };

/** A dashed arrow from the "before" value to the current one at the slider, with the change. */
function DeltaMark({ from, label, to, x }: { from: number; label: string; to: number; x: number }) {
  const scales = usePlotScales();
  const [px, top, bottom] = [scales.x.toPixel(x), scales.y.toPixel(from), scales.y.toPixel(to)];

  if (Math.abs(bottom - top) < MIN_DELTA_PIXELS) {
    return null;
  }

  const nearRight = px > scales.width / 2;

  return (
    <g aria-hidden="true" className="text-viz-highlight">
      <path
        className="fill-none stroke-current"
        d={`M${px} ${top} V${bottom}`}
        strokeDasharray="3 3"
        strokeWidth={1.5}
      />
      <text
        className="fill-current text-xs font-semibold tabular-nums"
        dominantBaseline="middle"
        textAnchor={nearRight ? "end" : "start"}
        x={nearRight ? px - DELTA_LABEL_GAP : px + DELTA_LABEL_GAP}
        y={(top + bottom) / 2}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * One output drawn across one slider's range, with the slider's position marked. A dashed
 * baseline shows the same output before the learner's other changes (the starting sliders or the
 * what-if events), so the chart shows what those changes did. Everything is described in words
 * by the renderer's text alternative.
 */
export function ActivityFormulaChart({
  baseline,
  current,
  deltaLabel,
  expected,
  formatTick,
  formatX,
  x,
  xDomain,
  yDomain,
}: {
  baseline: Curve | null;
  current: Curve;
  deltaLabel: string | null;
  expected: { x: number; y: number } | null;
  /** Short forms for the y axis, like "$300K". */
  formatTick: (value: number) => string;
  formatX: (value: number) => string;
  x: number;
  xDomain: NumericDomain;
  yDomain: NumericDomain;
}) {
  return (
    <ActivityPlot height={PLOT_HEIGHT} xDomain={xDomain} yDomain={yDomain}>
      <ActivityPlotGridY format={formatTick} ticks={niceTicks(yDomain, 3)} />
      <ActivityPlotAxisX format={formatX} ticks={[xDomain[0], xDomain[1]]} />

      {baseline && (
        <ActivityPlotLine
          className="stroke-muted-foreground stroke-2 [stroke-dasharray:5_5]"
          points={baseline.points}
        />
      )}

      {/* Shading under the curve only reads right when the axis starts at zero. */}
      {yDomain[0] >= 0 && <ActivityPlotArea points={current.points} />}
      <ActivityPlotLine points={current.points} />

      {baseline?.y !== null && baseline?.y !== undefined && current.y !== null && deltaLabel && (
        <DeltaMark from={baseline.y} label={deltaLabel} to={current.y} x={x} />
      )}

      {baseline?.y !== null && baseline?.y !== undefined && (
        <ActivityPlotDot
          className="fill-background stroke-muted-foreground"
          radius={MARK_RADIUS}
          x={x}
          y={baseline.y}
        />
      )}

      {expected && (
        <ActivityPlotDot
          className="fill-success"
          radius={EXPECTED_RADIUS}
          x={expected.x}
          y={expected.y}
        />
      )}

      {current.y !== null && (
        <>
          <ActivityPlotGuide x={x} y={current.y} />
          <ActivityPlotDot x={x} y={current.y} />
        </>
      )}
    </ActivityPlot>
  );
}
