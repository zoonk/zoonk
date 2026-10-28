"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { usePlotScales } from "../_components/activity-plot";
import { type Line, type Point, visibleSegment } from "./line-crossing-model";

const DOT_RADIUS = 6;
const LABEL_GAP = 8;
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
  className,
  domain,
  end,
  label,
  line,
}: {
  className: string;
  domain: Point;
  end: "lower" | "upper";
  label: string;
  line: Line;
}) {
  const { width, x, y } = usePlotScales();
  const { from, to } = visibleSegment(line, domain);
  const [lower, upper] = from.y < to.y ? [from, to] : [to, from];
  const point = end === "upper" ? upper : lower;
  const px = x.toPixel(point.x);
  const inLeftHalf = px < width / 2;

  return (
    <text
      aria-hidden="true"
      className={cn("fill-current text-xs font-semibold", className)}
      textAnchor={inLeftHalf ? "start" : "end"}
      x={inLeftHalf ? px + LABEL_GAP : px - LABEL_GAP}
      y={Math.max(y.toPixel(point.y) - LABEL_GAP, y.range[1] + LABEL_GAP)}
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

export function ChangeArrows({ after, before }: { after: Point; before: Point }) {
  const { x, y } = usePlotScales();
  const markerId = useId();
  const [left, bottom] = [x.range[0], y.range[0]];
  const yMoves = Math.abs(y.toPixel(after.y) - y.toPixel(before.y)) > DOT_RADIUS;
  const xMoves = Math.abs(x.toPixel(after.x) - x.toPixel(before.x)) > DOT_RADIUS;

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
      {yMoves && (
        <path
          className="fill-none stroke-current"
          d={`M${left + ARROW_OFFSET} ${y.toPixel(before.y)} V${y.toPixel(after.y)}`}
          markerEnd={`url(#${markerId})`}
          strokeWidth={2}
        />
      )}
      {xMoves && (
        <path
          className="fill-none stroke-current"
          d={`M${x.toPixel(before.x)} ${bottom - ARROW_OFFSET} H${x.toPixel(after.x)}`}
          markerEnd={`url(#${markerId})`}
          strokeWidth={2}
        />
      )}
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
