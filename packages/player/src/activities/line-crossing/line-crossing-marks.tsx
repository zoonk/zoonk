"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffectEvent, useId, useLayoutEffect, useRef } from "react";
import { usePlotScales } from "../_components/activity-plot";
import { DRAWING_LABEL_HALO, estimatedLabelWidth } from "../_utils/drawing-label";
import {
  ARROW_HEAD,
  ARROW_STROKE,
  type LabelBox,
  type LabelSize,
  changeArrows,
} from "./line-crossing-labels";
import { type ChartDomain, type Line, type Point, visibleSegment } from "./line-crossing-model";

const DOT_RADIUS = 6;
const Y_LABEL_RISE = 12;
const X_LABEL_DROP = 20;

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

  useLayoutEffect(() => {
    const node = ref.current;

    if (node) {
      const { height, width, x, y } = node.getBBox();

      measured({
        height,
        left: x - Number(node.getAttribute("x")),
        top: y - Number(node.getAttribute("y")),
        width,
      });
    }
  }, []);

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

const LABEL_ASCENT = 10;
const LABEL_DESCENT = 3;

/** Where the value axis's title sits over the chart, for the lines' names to keep clear of. */
export function yTitleBox({
  left,
  title,
  top,
}: {
  left: number;
  title: string;
  top: number;
}): LabelBox {
  const baseline = top - Y_LABEL_RISE;

  return {
    bottom: baseline + LABEL_DESCENT,
    left,
    right: left + estimatedLabelWidth(title),
    top: baseline - LABEL_ASCENT,
  };
}

export function Axes({ xLabel, yLabel }: { xLabel: string; yLabel: string }) {
  const { x, y } = usePlotScales();
  const [left, right] = x.range;
  const [bottom, top] = y.range;

  return (
    <g aria-hidden="true">
      <path
        className="stroke-foreground/40 fill-none"
        d={`M${left} ${top} V${bottom} H${right}`}
        strokeWidth={1.5}
      />
      <text className="fill-muted-foreground text-xs" x={left} y={top - Y_LABEL_RISE}>
        {yLabel}
      </text>
      <text
        className="fill-muted-foreground text-xs"
        textAnchor="end"
        x={right}
        y={bottom + X_LABEL_DROP}
      >
        {xLabel}
      </text>
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
