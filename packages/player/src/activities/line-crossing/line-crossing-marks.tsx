"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { useEffectEvent, useId, useLayoutEffect, useRef } from "react";
import { usePlotScales } from "../_components/activity-plot";
import { DRAWING_LABEL_HALO } from "../_utils/drawing-label";
import { type LabelBox, type LabelSize } from "./line-crossing-labels";
import { type Line, type Point, visibleSegment } from "./line-crossing-model";

const DOT_RADIUS = 6;
const ARROW_OFFSET = 10;
const Y_LABEL_RISE = 12;
const X_LABEL_DROP = 20;

export function LineMark({
  className,
  domain,
  isDashed,
  line,
}: {
  className: string;
  domain: Point;
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

export function LineLabel({
  box,
  className,
  label,
  onMeasure,
}: {
  box: LabelBox | null;
  className: string;
  label: string;
  onMeasure: (size: LabelSize) => void;
}) {
  const ref = useRef<SVGTextElement>(null);
  const measured = useEffectEvent(onMeasure);

  useLayoutEffect(() => {
    const node = ref.current;

    if (node) {
      measured({
        height: Number(getComputedStyle(node).fontSize.replace("px", "")),
        width: node.getBBox().width,
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
      x={box?.left ?? 0}
      y={box ? (box.top + box.bottom) / 2 : 0}
    >
      {label}
    </text>
  );
}

export function Crossing({ isBefore, point }: { isBefore: boolean; point: Point }) {
  const { x, y } = usePlotScales();
  const [px, py] = [x.toPixel(point.x), y.toPixel(point.y)];

  return (
    <g aria-hidden="true">
      <path
        className={cn(
          "fill-none",
          isBefore ? "stroke-muted-foreground/50" : "stroke-foreground/60",
        )}
        d={`M${x.range[0]} ${py} H${px} V${y.range[0]}`}
        strokeDasharray="3 3"
        strokeWidth={1.5}
      />
      <circle
        className={
          isBefore ? "fill-background stroke-muted-foreground" : "fill-foreground stroke-background"
        }
        cx={px}
        cy={py}
        r={DOT_RADIUS}
        strokeWidth={2}
      />
    </g>
  );
}

export const CROSSING_RADIUS = DOT_RADIUS + 1;

export function changeArrows({
  after,
  before,
  x,
  y,
}: {
  after: Point;
  before: Point;
  x: LinearScale;
  y: LinearScale;
}): { from: Point; to: Point }[] {
  const [left, bottom] = [x.range[0], y.range[0]];

  const arrows = [
    {
      from: { x: left + ARROW_OFFSET, y: y.toPixel(before.y) },
      to: { x: left + ARROW_OFFSET, y: y.toPixel(after.y) },
    },
    {
      from: { x: x.toPixel(before.x), y: bottom - ARROW_OFFSET },
      to: { x: x.toPixel(after.x), y: bottom - ARROW_OFFSET },
    },
  ];

  return arrows.filter(({ from, to }) => Math.hypot(to.x - from.x, to.y - from.y) > DOT_RADIUS);
}

export function ChangeArrows({ after, before }: { after: Point; before: Point }) {
  const { x, y } = usePlotScales();
  const markerId = useId();

  return (
    <g aria-hidden="true" className="text-foreground">
      <defs>
        <marker
          id={markerId}
          markerHeight={7}
          markerWidth={7}
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
      {changeArrows({ after, before, x, y }).map(({ from, to }) => (
        <path
          className="fill-none stroke-current"
          d={`M${from.x} ${from.y} L${to.x} ${to.y}`}
          key={from.x === to.x ? "y" : "x"}
          markerEnd={`url(#${markerId})`}
          strokeWidth={2}
        />
      ))}
    </g>
  );
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
