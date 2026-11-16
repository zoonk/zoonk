"use client";

import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale, type NumericDomain, createLinearScale } from "@zoonk/utils/plot-scale";
import { createContext, use } from "react";
import { edgeAnchor, estimatedLabelWidth } from "../_utils/drawing-label";
import { PLOT_DOT_RADIUS, PLOT_DOT_STROKE, PLOT_TICK_ROOM, TICK_GAP } from "../_utils/plot-ticks";
import { type PlotPoint, linePath } from "../_utils/sample-formula";

type PlotPadding = { bottom: number; left: number; right: number; top: number };

type PlotScales = { height: number; width: number; x: LinearScale; y: LinearScale };

const FALLBACK_WIDTH = 318;
export const PLOT_LINE_WIDTH = 3;
const DEFAULT_PADDING: PlotPadding = { bottom: 24, left: PLOT_TICK_ROOM, right: 12, top: 12 };
const X_LABEL_OFFSET = 18;
const GUIDE_STROKE = 1.5;

const PlotContext = createContext<PlotScales | null>(null);

export function usePlotScales(): PlotScales {
  const scales = use(PlotContext);

  if (!scales) {
    throw new Error("usePlotScales must be used inside ActivityPlot");
  }

  return scales;
}

export function ActivityPlot({
  children,
  className,
  height: heightProp,
  padding = DEFAULT_PADDING,
  xDomain,
  xLabel,
  yDomain,
}: {
  children: React.ReactNode;
  className?: string;
  height: number | ((width: number) => number);
  padding?: Partial<PlotPadding>;
  xDomain: NumericDomain;
  xLabel?: string;
  yDomain: NumericDomain;
}) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const inset = { ...DEFAULT_PADDING, ...padding };
  const height = typeof heightProp === "number" ? heightProp : heightProp(width);

  const scales: PlotScales = {
    height,
    width,
    x: createLinearScale({ domain: xDomain, range: [inset.left, width - inset.right] }),
    y: createLinearScale({ domain: yDomain, range: [height - inset.bottom, inset.top] }),
  };

  return (
    <div
      className={cn("flex w-full flex-col gap-1", className)}
      data-slot="activity-plot"
      ref={ref}
    >
      <svg
        className="block overflow-visible text-xs tabular-nums select-none"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <PlotContext value={scales}>{children}</PlotContext>
      </svg>
      {xLabel && (
        <p
          className="text-muted-foreground text-right text-xs text-balance"
          style={{ marginInlineEnd: inset.right, marginInlineStart: inset.left }}
        >
          {xLabel}
        </p>
      )}
    </div>
  );
}

export function ActivityPlotGridY({
  format,
  ticks,
}: {
  format: (value: number) => string;
  ticks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [left, right] = x.range;
  const baseline = Math.min(...ticks);

  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <g key={tick}>
          <path
            className="stroke-viz-grid"
            d={`M${left} ${y.toPixel(tick)} H${right}`}
            strokeDasharray={tick === baseline ? undefined : "3 4"}
          />
          <text
            className="fill-muted-foreground"
            dominantBaseline="middle"
            x={left - TICK_GAP}
            y={y.toPixel(tick)}
            textAnchor="end"
          >
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function ActivityPlotAxisX({
  format,
  ticks,
}: {
  format: (value: number) => string;
  ticks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [bottom] = y.range;

  return (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const label = format(tick);
        const at = x.toPixel(tick);

        return (
          <text
            className="fill-muted-foreground"
            key={tick}
            textAnchor={edgeAnchor({ at, range: x.range, width: estimatedLabelWidth(label) })}
            x={at}
            y={bottom + X_LABEL_OFFSET}
          >
            {label}
          </text>
        );
      })}
    </g>
  );
}

function toPixels(points: readonly PlotPoint[], scales: PlotScales): PlotPoint[] {
  return points.map((point) => ({ x: scales.x.toPixel(point.x), y: scales.y.toPixel(point.y) }));
}

export function ActivityPlotLine({
  className,
  points,
}: {
  className?: string;
  points: readonly PlotPoint[];
}) {
  const scales = usePlotScales();

  return (
    <path
      aria-hidden="true"
      className={cn("stroke-viz-accent fill-none", className)}
      d={linePath(toPixels(points, scales))}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={PLOT_LINE_WIDTH}
    />
  );
}

export function ActivityPlotArea({
  className,
  points,
}: {
  className?: string;
  points: readonly PlotPoint[];
}) {
  const scales = usePlotScales();
  const pixels = toPixels(points, scales);
  const [bottom] = scales.y.range;
  const [first, last] = [pixels[0], pixels.at(-1)];

  if (!first || !last) {
    return null;
  }

  return (
    <path
      aria-hidden="true"
      className={cn("fill-viz-accent-soft", className)}
      d={`${linePath(pixels)} L${last.x} ${bottom} L${first.x} ${bottom} Z`}
    />
  );
}

export function ActivityPlotGuide({
  className,
  x: dataX,
  y: dataY,
}: {
  className?: string;
  x: number;
  y: number;
}) {
  const { x, y } = usePlotScales();
  const [px, py] = [x.toPixel(dataX), y.toPixel(dataY)];

  return (
    <path
      aria-hidden="true"
      className={cn("stroke-viz-accent/40 fill-none", className)}
      d={`M${px} ${y.range[0]} V${py} H${x.range[0]}`}
      strokeDasharray="3 3"
      strokeWidth={GUIDE_STROKE}
    />
  );
}

export function ActivityPlotDot({
  className,
  radius = PLOT_DOT_RADIUS,
  x: dataX,
  y: dataY,
}: {
  className?: string;
  radius?: number;
  x: number;
  y: number;
}) {
  const { x, y } = usePlotScales();

  return (
    <circle
      aria-hidden="true"
      className={cn("fill-viz-accent stroke-background", className)}
      cx={x.toPixel(dataX)}
      cy={y.toPixel(dataY)}
      r={radius}
      strokeWidth={PLOT_DOT_STROKE}
    />
  );
}

export function ActivityPlotBand({
  className,
  from,
  to,
}: {
  className?: string;
  from: number;
  to: number;
}) {
  const { x, y } = usePlotScales();
  const [bottom, top] = y.range;
  const [left, right] = [x.toPixel(Math.min(from, to)), x.toPixel(Math.max(from, to))];

  return (
    <rect
      aria-hidden="true"
      className={cn("fill-viz-secondary-soft", className)}
      height={bottom - top}
      width={Math.max(right - left, 1)}
      x={left}
      y={top}
    />
  );
}

export function ActivityPlotLabel({
  anchor = "middle",
  children,
  className,
  dy = 0,
  x: dataX,
  y: dataY,
}: {
  anchor?: "start" | "middle" | "end";
  children: React.ReactNode;
  className?: string;
  dy?: number;
  x: number;
  y: number;
}) {
  const { x, y } = usePlotScales();

  return (
    <text
      aria-hidden="true"
      className={cn("fill-foreground font-semibold", className)}
      textAnchor={anchor}
      x={x.toPixel(dataX)}
      y={y.toPixel(dataY) + dy}
    >
      {children}
    </text>
  );
}
