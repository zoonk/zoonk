"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffectEvent, useId, useLayoutEffect, useRef } from "react";
import { ActivityPlotGridY, usePlotScales } from "../_components/activity-plot";
import { ActivityPlotAxisX } from "../_components/activity-plot-axis";
import { DRAWING_LABEL_HALO, measureDrawingLabel } from "../_utils/drawing-label";
import {
  ARROW_HEAD,
  ARROW_STROKE,
  type LabelBox,
  type LabelSize,
  changeArrows,
} from "./line-crossing-labels";
import { type ChartDomain, type Line, type Point, visibleSegment } from "./line-crossing-model";

const DOT_RADIUS = 6;

export function LineMark({
  className,
  domain,
  isDashed,
  line,
}: {
  className: string;
  domain: ChartDomain;
  isDashed?: boolean;
  line: Line;
}) {
  const { x, y } = usePlotScales();
  const { from, to } = visibleSegment(line, domain);

  return (
    <path
      aria-hidden="true"
      className={cn("fill-none", className)}
      d={`M${x.toPixel(from.x)} ${y.toPixel(from.y)} L${x.toPixel(to.x)} ${y.toPixel(to.y)}`}
      strokeDasharray={isDashed ? "5 5" : undefined}
      strokeLinecap="round"
      strokeWidth={isDashed ? 2 : 3}
    />
  );
}

export type LineLabelMetrics = LabelSize & { left: number; top: number };

export function LineLabel({
  box,
  className,
  label,
  onMeasure,
  metrics,
}: {
  box: LabelBox | null;
  className: string;
  label: string;
  metrics: LineLabelMetrics | undefined;
  onMeasure: (size: LineLabelMetrics) => void;
}) {
  const ref = useRef<SVGTextElement>(null);
  const measured = useEffectEvent(onMeasure);
  const last = useRef<LineLabelMetrics>(undefined);

  useLayoutEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const measure = () => {
      const size = measureDrawingLabel({ element: node });

      const next = {
        height: size.height,
        left: size.offsetX - size.width / 2,
        top: size.offsetY - size.height / 2,
        width: size.width,
      };

      const previous = last.current;

      if (
        previous?.height === next.height &&
        previous.width === next.width &&
        previous.left === next.left &&
        previous.top === next.top
      ) {
        return;
      }

      last.current = next;
      measured(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    document.fonts.addEventListener("loadingdone", measure);

    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Same-size translations can change ink bearings without resizing the observed box.
  }, [label]);

  return (
    <text
      aria-hidden="true"
      className={cn("fill-current text-xs font-semibold", DRAWING_LABEL_HALO, className)}
      dominantBaseline="central"
      ref={ref}
      visibility={box ? undefined : "hidden"}
      x={box && metrics ? box.left - metrics.left : 0}
      y={box && metrics ? box.top - metrics.top : 0}
    >
      {label}
    </text>
  );
}

export function crossingGuides(point: Point, left: number, bottom: number) {
  return [
    { from: { x: left, y: point.y }, to: point },
    { from: point, to: { x: point.x, y: bottom } },
  ] as const;
}

export function CrossingGuide({ isBefore, point }: { isBefore: boolean; point: Point }) {
  const { x, y } = usePlotScales();

  const [horizontal, vertical] = crossingGuides(
    { x: x.toPixel(point.x), y: y.toPixel(point.y) },
    x.range[0],
    y.range[0],
  );

  return (
    <path
      aria-hidden="true"
      className={cn("fill-none", isBefore ? "stroke-muted-foreground/50" : "stroke-foreground/60")}
      d={`M${horizontal.from.x} ${horizontal.from.y} H${horizontal.to.x} V${vertical.to.y}`}
      strokeDasharray="3 3"
      strokeWidth={1.5}
    />
  );
}

export function CrossingDot({ isBefore, point }: { isBefore: boolean; point: Point }) {
  const { x, y } = usePlotScales();

  return (
    <circle
      aria-hidden="true"
      className={cn(
        "pointer-events-none",
        isBefore ? "fill-background stroke-muted-foreground" : "fill-foreground stroke-background",
      )}
      cx={x.toPixel(point.x)}
      cy={y.toPixel(point.y)}
      r={DOT_RADIUS}
      strokeWidth={2}
    />
  );
}

export const CROSSING_RADIUS = DOT_RADIUS + 1;

export function ChangeArrows({ after, before }: { after: Point; before: Point }) {
  const { x, y } = usePlotScales();
  const markerId = useId();

  return (
    <g aria-hidden="true" className="text-foreground">
      <defs>
        <marker
          id={markerId}
          markerHeight={ARROW_HEAD}
          markerWidth={ARROW_HEAD}
          orient="auto-start-reverse"
          refX={7}
          refY={5}
          viewBox="0 0 10 10"
        >
          <path
            className="fill-none stroke-current"
            d="M1 1 L9 5 L1 9"
            strokeLinecap="round"
            strokeWidth={2}
          />
        </marker>
      </defs>
      {changeArrows({
        after: { x: x.toPixel(after.x), y: y.toPixel(after.y) },
        before: { x: x.toPixel(before.x), y: y.toPixel(before.y) },
        bottom: y.range[0],
        left: x.range[0],
      }).map(({ from, to }) => (
        <path
          className="fill-none stroke-current"
          d={`M${from.x} ${from.y} L${to.x} ${to.y}`}
          key={from.x === to.x ? "y" : "x"}
          markerEnd={`url(#${markerId})`}
          strokeWidth={ARROW_STROKE}
        />
      ))}
    </g>
  );
}

export function Axes({
  format,
  xTicks,
  yTicks,
}: {
  format: (value: number) => string;
  xTicks: readonly number[];
  yTicks: readonly number[];
}) {
  const { x, y } = usePlotScales();
  const [left, right] = x.range;
  const [bottom, top] = y.range;

  return (
    <g aria-hidden="true">
      <ActivityPlotGridY format={format} ticks={yTicks} />
      <ActivityPlotAxisX format={format} ticks={xTicks} />
      <path
        className="stroke-foreground/40 fill-none"
        d={`M${left} ${top} V${bottom} H${right}`}
        strokeWidth={1.5}
      />
    </g>
  );
}

export function ClipArea({ id }: { id: string }) {
  const { x, y } = usePlotScales();

  return (
    <defs>
      <clipPath id={id}>
        <rect
          height={y.range[0] - y.range[1]}
          width={x.range[1] - x.range[0]}
          x={x.range[0]}
          y={y.range[1]}
        />
      </clipPath>
    </defs>
  );
}
