"use client";

import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { estimatedLabelWidth, touchesSegment } from "../_utils/drawing-label";
import { tickLabels } from "../_utils/plot-ticks";
import { type PlotPoint } from "../_utils/sample-formula";
import {
  ActivityPlot,
  ActivityPlotArea,
  ActivityPlotDot,
  ActivityPlotGridY,
  ActivityPlotGuide,
  ActivityPlotLine,
  PLOT_LINE_WIDTH,
  usePlotScales,
} from "./activity-plot";
import { ActivityPlotAxisX } from "./activity-plot-axis";

const PLOT_HEIGHT = 168;
const TOP_ROOM = 28;
const MARK_RADIUS = 4.5;
const EXPECTED_RADIUS = 7;
const DELTA_LABEL_GAP = 8;
const EXPECTED_LABEL_GAP = EXPECTED_RADIUS + DELTA_LABEL_GAP / 2;
const EXPECTED_LABEL_HALO = 3;
const LABEL_HEIGHT = 12;
const MIN_DELTA_PIXELS = 12;

type Curve = { points: readonly PlotPoint[]; y: number | null };

function DeltaMark({
  from,
  label,
  to,
  x,
}: {
  from: number;
  label: string | null;
  to: number;
  x: number;
}) {
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
      {label && (
        <text
          className="fill-current text-xs font-semibold tabular-nums"
          dominantBaseline="middle"
          textAnchor={nearRight ? "end" : "start"}
          x={nearRight ? px - DELTA_LABEL_GAP : px + DELTA_LABEL_GAP}
          y={(top + bottom) / 2}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function ExpectedMark({
  baseline,
  label,
  line,
  x,
  y,
}: {
  baseline: Curve | null;
  label: string;
  line: readonly PlotPoint[];
  x: number;
  y: number;
}) {
  const scales = usePlotScales();
  const mark = { x: scales.x.toPixel(x), y: scales.y.toPixel(y) };
  const halfWidth = estimatedLabelWidth(label) / 2;
  const halfHeight = LABEL_HEIGHT / 2;
  const [left, right] = scales.x.range;
  const [bottom] = scales.y.range;
  const labelX = Math.max(left + halfWidth, Math.min(mark.x, right - halfWidth));

  const plotPoint = (point: PlotPoint) => ({
    x: scales.x.toPixel(point.x),
    y: scales.y.toPixel(point.y),
  });

  const segments = [line, baseline?.points ?? []].flatMap((curve) =>
    curve
      .slice(1)
      .map((point, index) => ({ from: plotPoint(curve[index] ?? point), to: plotPoint(point) })),
  );

  const nearest = EXPECTED_LABEL_GAP + halfHeight;

  const candidates = Array.from({ length: Math.ceil(bottom / halfHeight) }, (_, index) => {
    const offset = nearest + index * halfHeight;
    return [mark.y - offset, mark.y + offset];
  }).flat();

  const labelY =
    candidates.find((at) => {
      if (at < halfHeight || at > bottom - halfHeight) {
        return false;
      }

      const box = {
        bottom: at + halfHeight,
        left: labelX - halfWidth,
        right: labelX + halfWidth,
        top: at - halfHeight,
      };

      return segments.every((segment) => !touchesSegment(box, segment, EXPECTED_LABEL_GAP));
    }) ?? halfHeight;

  return (
    <>
      <ActivityPlotDot className="fill-success-text" radius={EXPECTED_RADIUS} x={x} y={y} />
      <text
        aria-hidden="true"
        className="fill-success-text stroke-background text-xs font-semibold tabular-nums [paint-order:stroke]"
        dominantBaseline="central"
        strokeWidth={EXPECTED_LABEL_HALO}
        textAnchor="middle"
        x={labelX}
        y={labelY}
      >
        {label}
      </text>
    </>
  );
}

export function ActivityFormulaChart({
  baseline,
  compare = null,
  current,
  deltaLabel,
  expected,
  formatTick,
  formatX,
  x,
  xDomain,
  xLabel,
  yDomain,
  yLabel,
}: {
  baseline: Curve | null;
  compare?: { x: number; y: number } | null;
  current: Curve;
  deltaLabel: string | null;
  expected: { label: string; x: number; y: number } | null;
  /** `isShort` when the axis has no room for the number in full. */
  formatTick: (value: number, isShort: boolean) => string;
  formatX: (value: number) => string;
  x: number;
  xDomain: NumericDomain;
  xLabel?: string;
  yDomain: NumericDomain;
  yLabel?: string;
}) {
  const ticks = niceTicks(yDomain, 3);
  const labels = tickLabels({ format: formatTick, ticks });

  return (
    <ActivityPlot
      height={PLOT_HEIGHT}
      padding={{ left: labels.room, right: PLOT_LINE_WIDTH / 2, top: TOP_ROOM }}
      xDomain={xDomain}
      xLabel={xLabel}
      yDomain={yDomain}
      yLabel={yLabel}
    >
      <ActivityPlotGridY format={labels.format} ticks={ticks} />
      <ActivityPlotAxisX format={formatX} ticks={[xDomain[0], xDomain[1]]} />

      {baseline && (
        <ActivityPlotLine
          className="stroke-muted-foreground stroke-2 [stroke-dasharray:5_5]"
          points={baseline.points}
        />
      )}

      {yDomain[0] >= 0 && <ActivityPlotArea points={current.points} />}
      <ActivityPlotLine points={current.points} />

      {baseline?.y !== null && baseline?.y !== undefined && current.y !== null && deltaLabel && (
        // Once checked, the right answer's label takes the change label's place; the readouts still say it.
        <DeltaMark from={baseline.y} label={expected ? null : deltaLabel} to={current.y} x={x} />
      )}

      {baseline?.y !== null && baseline?.y !== undefined && (
        <ActivityPlotDot
          className="fill-background stroke-muted-foreground"
          radius={MARK_RADIUS}
          x={x}
          y={baseline.y}
        />
      )}

      {compare && (
        <ActivityPlotDot
          className="fill-viz-accent-soft stroke-viz-accent"
          radius={MARK_RADIUS}
          x={compare.x}
          y={compare.y}
        />
      )}

      {current.y !== null && (
        <>
          <ActivityPlotGuide x={x} y={current.y} />
          <ActivityPlotDot x={x} y={current.y} />
        </>
      )}

      {expected && (
        <ExpectedMark
          baseline={baseline}
          label={expected.label}
          line={current.points}
          x={expected.x}
          y={expected.y}
        />
      )}
    </ActivityPlot>
  );
}
