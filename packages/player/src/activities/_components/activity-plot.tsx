"use client";

import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale, type NumericDomain, createLinearScale } from "@zoonk/utils/plot-scale";
import { createContext, use } from "react";
import { type PlotPoint, linePath } from "../_utils/sample-formula";

type PlotPadding = { bottom: number; left: number; right: number; top: number };

type PlotScales = { height: number; width: number; x: LinearScale; y: LinearScale };

/** Phone width of the canvas, used until the real width is measured. */
const FALLBACK_WIDTH = 318;
const DEFAULT_PADDING: PlotPadding = { bottom: 24, left: 44, right: 12, top: 12 };
const LABEL_GAP = 6;
const X_LABEL_OFFSET = 18;
const DOT_RADIUS = 6;
const DOT_STROKE = 2.5;
const GUIDE_STROKE = 1.5;

const PlotContext = createContext<PlotScales | null>(null);

/** Scales of the surrounding plot, for renderers that draw their own marks (bars, arrows). */
export function usePlotScales(): PlotScales {
  const scales = use(PlotContext);

  if (!scales) {
    throw new Error("usePlotScales must be used inside ActivityPlot");
  }

  return scales;
}

/**
 * An SVG chart drawn at the canvas's real width, so text stays 12px on every screen. Children
 * are plot primitives in data coordinates. Decorative marks are hidden from screen readers; the
 * canvas's text alternative describes what the plot shows.
 */
export function ActivityPlot({
  children,
  className,
  height: heightProp,
  padding = DEFAULT_PADDING,
  xDomain,
  yDomain,
}: {
  children: React.ReactNode;
  className?: string;
  /** Pixels, or a function of the measured width for drawings that keep their proportions. */
  height: number | ((width: number) => number);
  padding?: Partial<PlotPadding>;
  xDomain: NumericDomain;
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
    <div className={cn("w-full", className)} data-slot="activity-plot" ref={ref}>
      <svg
        className="block overflow-visible text-xs tabular-nums"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <PlotContext value={scales}>{children}</PlotContext>
      </svg>
    </div>
  );
}

/** Horizontal gridlines with their labels on the left; the lowest one is the solid baseline. */
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
            className="stroke-border"
            d={`M${left} ${y.toPixel(tick)} H${right}`}
            strokeDasharray={tick === baseline ? undefined : "3 4"}
          />
          <text
            className="fill-muted-foreground"
            dominantBaseline="middle"
            x={left - LABEL_GAP}
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

/** Labels under the plot at the given x values. */
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
      {ticks.map((tick) => (
        <text
          className="fill-muted-foreground"
          key={tick}
          textAnchor="middle"
          x={x.toPixel(tick)}
          y={bottom + X_LABEL_OFFSET}
        >
          {format(tick)}
        </text>
      ))}
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
      strokeWidth={3}
    />
  );
}

/** The area between a line and the bottom of the plot. */
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

/** Dashed lines from a point down to the x axis and across to the y axis. */
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
  radius = DOT_RADIUS,
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
      strokeWidth={DOT_STROKE}
    />
  );
}

/** A shaded vertical band between two x values, like a measured span. */
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
