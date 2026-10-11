"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { ActivityPlot, usePlotScales } from "../_components/activity-plot";
import { type HistogramBin } from "./sampling";

const PLOT_HEIGHT = 176;
const PLOT_PADDING = { bottom: 52, left: 10, right: 10, top: 24 };
const BAR_GAP = 1;
const BAR_RADIUS = 2;
const TICK_OFFSET = 16;
const BRACKET_OFFSET = 26;
const BRACKET_TICK = 4;
const RANGE_LABEL_OFFSET = 42;
const TRUTH_LABEL_OFFSET = 8;
const AXIS_TICKS = 4;
/** Axis labels this close to the middle range's label would collide with it. */
const LABEL_CLEARANCE = 44;

function Bars({ bins, className }: { bins: readonly HistogramBin[]; className: string }) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;

  return (
    <g aria-hidden="true" className={className}>
      {bins
        .filter((bin) => bin.count > 0)
        .map((bin) => {
          const left = x.toPixel(bin.from) + BAR_GAP / 2;
          const width = Math.max(x.toPixel(bin.to) - x.toPixel(bin.from) - BAR_GAP, 1);

          return (
            <rect
              height={Math.max(bottom - y.toPixel(bin.count), 0)}
              key={bin.from}
              rx={Math.min(BAR_RADIUS, width / 2)}
              width={width}
              x={left}
              y={y.toPixel(bin.count)}
            />
          );
        })}
    </g>
  );
}

function TruthLine({ label, truth }: { label: string; truth: number }) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;

  return (
    <g aria-hidden="true">
      <path
        className="stroke-foreground"
        d={`M${x.toPixel(truth)} ${bottom} V${top}`}
        strokeDasharray="4 3"
        strokeWidth={1.5}
      />
      <text
        className="fill-foreground text-xs font-bold"
        textAnchor="middle"
        x={x.toPixel(truth)}
        y={top - TRUTH_LABEL_OFFSET}
      >
        {label}
      </text>
    </g>
  );
}

/** The axis with round labels, and under it the bracket over the middle 95% of results. */
function AxisWithRange({
  format,
  range,
  rangeLabel,
}: {
  format: (value: number) => string;
  range: NumericDomain;
  rangeLabel: string;
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;
  const [left, right] = x.range;
  const [from, to] = [x.toPixel(range[0]), x.toPixel(range[1])];
  const bracketY = bottom + BRACKET_OFFSET;
  const middle = (from + to) / 2;

  const ticks = niceTicks([x.toValue(left), x.toValue(right)], AXIS_TICKS).filter(
    (tick) => Math.abs(x.toPixel(tick) - middle) >= LABEL_CLEARANCE,
  );

  return (
    <g aria-hidden="true">
      <path className="stroke-border" d={`M${left} ${bottom} H${right}`} strokeWidth={1.5} />

      {ticks.map((tick) => (
        <text
          className="fill-muted-foreground"
          key={tick}
          textAnchor="middle"
          x={x.toPixel(tick)}
          y={bottom + TICK_OFFSET}
        >
          {format(tick)}
        </text>
      ))}

      <path
        className="stroke-viz-accent fill-none"
        d={`M${from} ${bracketY - BRACKET_TICK} V${bracketY} H${to} V${bracketY - BRACKET_TICK}`}
        strokeWidth={1.5}
      />
      <text
        className="fill-viz-accent text-xs font-semibold"
        textAnchor="middle"
        x={middle}
        y={bottom + RANGE_LABEL_OFFSET}
      >
        {rangeLabel}
      </text>
    </g>
  );
}

/**
 * The results of every run as a histogram: the chosen sample size in color over the smallest one
 * in gray, the true value as a dashed line, and the middle 95% of the chosen size's results
 * bracketed under the axis.
 */
export function SamplingChart({
  comparison,
  domain,
  format,
  maxCount,
  range,
  rangeLabel,
  results,
  truth,
  truthLabel,
}: {
  comparison: readonly HistogramBin[] | null;
  domain: NumericDomain;
  format: (value: number) => string;
  maxCount: number;
  range: NumericDomain;
  rangeLabel: string;
  results: readonly HistogramBin[];
  truth: number;
  truthLabel: string;
}) {
  return (
    <ActivityPlot
      height={PLOT_HEIGHT}
      padding={PLOT_PADDING}
      xDomain={domain}
      yDomain={[0, maxCount]}
    >
      {comparison && <Bars bins={comparison} className="fill-muted-foreground/30" />}
      <Bars bins={results} className={cn("fill-viz-accent")} />
      <TruthLine label={truthLabel} truth={truth} />
      <AxisWithRange format={format} range={range} rangeLabel={rangeLabel} />
    </ActivityPlot>
  );
}
