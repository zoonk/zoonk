"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { ActivityPlotAxisX, ActivityPlotGridY, usePlotScales } from "../_components/activity-plot";
import {
  DRAWING_LABEL_HALO,
  estimatedLabelWidth,
  measureDrawingLabel,
} from "../_utils/drawing-label";
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
const X_LABEL_DROP = 42;

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
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const measure = () => {
      const size = measureDrawingLabel({ element: node });
      const next = { x: size.offsetX - size.width / 2, y: size.offsetY };
      setOffset((known) => (known.x === next.x && known.y === next.y ? known : next));
      measured({ height: size.height, width: size.width });
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
      x={box ? box.left - offset.x : 0}
      y={box ? (box.top + box.bottom) / 2 - offset.y : 0}
    >
      {label}
    </text>
  );
}

export function CrossingGuide({ isBefore, point }: { isBefore: boolean; point: Point }) {
  const { x, y } = usePlotScales();
  const [px, py] = [x.toPixel(point.x), y.toPixel(point.y)];

  return (
    <path
      aria-hidden="true"
      className={cn("fill-none", isBefore ? "stroke-muted-foreground/50" : "stroke-foreground/60")}
      d={`M${x.range[0]} ${py} H${px} V${y.range[0]}`}
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

export function Axes({
  format,
  xLabel,
  xTicks,
  yLabel,
  yTicks,
}: {
  format: (value: number) => string;
  xLabel: string;
  xTicks: readonly number[];
  yLabel: string;
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
