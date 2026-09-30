"use client";

import { cn } from "@zoonk/ui/lib/utils";
import {
  ActivityPlot,
  ActivityPlotAxisX,
  ActivityPlotGridY,
  ActivityPlotLabel,
  ActivityPlotLine,
  usePlotScales,
} from "../_components/activity-plot";
import { useFormatNumber } from "../_utils/use-format-number";
import { outcomeCounts, runningShare } from "./simulation";

const CHART_HEIGHT = 148;
const BAR_GAP = 0.18;
const LINE_POINTS = 120;
const PERCENT = 100;
const GUESS_LABEL_OFFSET = -6;
const HALF = 0.5;
const BAR_ROUNDING = 0.25;
const MAX_BAR_RADIUS = 3;

function Bars({
  bars,
  isHit,
}: {
  bars: { count: number; outcome: number }[];
  isHit: (outcome: number) => boolean;
}) {
  const { x, y } = usePlotScales();
  const width = Math.max(x.toPixel(1) - x.toPixel(0), 1) * (1 - BAR_GAP);
  const [bottom] = y.range;

  return (
    <g aria-hidden="true">
      {bars.map((bar) => (
        <rect
          className={cn(isHit(bar.outcome) ? "fill-viz-highlight" : "fill-muted-foreground/30")}
          height={Math.max(bottom - y.toPixel(bar.count), 0)}
          key={bar.outcome}
          rx={Math.min(width * BAR_ROUNDING, MAX_BAR_RADIUS)}
          width={width}
          x={x.toPixel(bar.outcome) - width / 2}
          y={y.toPixel(bar.count)}
        />
      ))}
    </g>
  );
}

/**
 * How often each outcome came up, with the outcomes that count as a hit highlighted. The axis
 * uses every run, so bars grow in place while the simulation fills in.
 */
export function OutcomeHistogram({
  allOutcomes,
  isHit,
  shownOutcomes,
}: {
  allOutcomes: readonly number[];
  isHit: (outcome: number) => boolean;
  shownOutcomes: readonly number[];
}) {
  const format = useFormatNumber();
  const all = outcomeCounts(allOutcomes);
  const [first, last] = [all[0]?.outcome ?? 0, all.at(-1)?.outcome ?? 1];
  const shown = outcomeCounts(shownOutcomes).filter((bar) => bar.count > 0);
  const hitTicks = all.filter((bar) => isHit(bar.outcome)).map((bar) => bar.outcome);
  const ticks = [...new Set([first, last, ...(hitTicks.length === 1 ? hitTicks : [])])];

  return (
    <ActivityPlot
      height={CHART_HEIGHT}
      padding={{ left: 8, right: 8 }}
      xDomain={[first - HALF, last + HALF]}
      yDomain={[0, Math.max(...all.map((bar) => bar.count), 1)]}
    >
      <Bars bars={shown} isHit={isHit} />
      <ActivityPlotAxisX format={(value) => format(value)} ticks={ticks} />
    </ActivityPlot>
  );
}

/**
 * The share of runs that hit, drawn as it settles run after run, against the learner's guess.
 */
export function RunningShareChart({
  guess,
  guessLabel,
  hits,
  runs,
}: {
  guess: number | null;
  guessLabel: string;
  hits: readonly boolean[];
  runs: number;
}) {
  const format = useFormatNumber();

  const percent = (value: number) =>
    format(value * PERCENT, { maximumFractionDigits: 0, unit: "%" });

  return (
    <ActivityPlot height={CHART_HEIGHT} xDomain={[0, runs]} yDomain={[0, 1]}>
      <ActivityPlotGridY format={percent} ticks={[0, HALF, 1]} />
      <ActivityPlotAxisX format={(value) => format(value)} ticks={[0, runs]} />

      {guess !== null && (
        <>
          <ActivityPlotLine
            className="stroke-destructive stroke-2 [stroke-dasharray:5_4]"
            points={[
              { x: 0, y: guess },
              { x: runs, y: guess },
            ]}
          />
          <ActivityPlotLabel
            anchor="end"
            className="fill-destructive text-xs"
            dy={GUESS_LABEL_OFFSET}
            x={runs}
            y={guess}
          >
            {guessLabel}
          </ActivityPlotLabel>
        </>
      )}

      <ActivityPlotLine points={runningShare(hits, LINE_POINTS)} />
    </ActivityPlot>
  );
}
