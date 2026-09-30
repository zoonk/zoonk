"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { usePlotScales } from "../_components/activity-plot";
import { type Line, type Point, priceAt, quantityAt } from "./supply-demand-model";

const DOT_RADIUS = 6;
const LABEL_GAP = 8;
const ARROW_OFFSET = 10;
const PRICE_LABEL_RISE = 12;
const QUANTITY_LABEL_DROP = 20;

type AxisLabels = { priceLabel: string; quantityLabel: string };

/** The stretch of a line inside the chart: from zero price or quantity to the chart's edges. */
function visibleSegment(line: Line, domain: { price: number; quantity: number }) {
  const ends = [quantityAt(line, 0), quantityAt(line, domain.price)]
    .map((quantity) => Math.min(Math.max(quantity, 0), domain.quantity))
    .toSorted((first, second) => first - second);

  const [from = 0, to = 0] = ends;

  return {
    from: { price: priceAt(line, from), quantity: from },
    to: { price: priceAt(line, to), quantity: to },
  };
}

export function CurveLine({
  className,
  domain,
  isDashed,
  line,
}: {
  className: string;
  domain: { price: number; quantity: number };
  isDashed?: boolean;
  line: Line;
}) {
  const { x, y } = usePlotScales();
  const { from, to } = visibleSegment(line, domain);

  return (
    <path
      aria-hidden="true"
      className={cn("fill-none", className)}
      d={`M${x.toPixel(from.quantity)} ${y.toPixel(from.price)} L${x.toPixel(to.quantity)} ${y.toPixel(to.price)}`}
      strokeDasharray={isDashed ? "5 5" : undefined}
      strokeLinecap="round"
      strokeWidth={isDashed ? 2 : 3}
    />
  );
}

/**
 * A curve's name at one end of it, kept inside the chart: it reads away from the nearer side,
 * so a label at the price axis never runs off the edge.
 */
export function CurveLabel({
  className,
  domain,
  end,
  label,
  line,
}: {
  className: string;
  domain: { price: number; quantity: number };
  /** Which end of the curve: the higher-priced one or the lower-priced one. */
  end: "lower" | "upper";
  label: string;
  line: Line;
}) {
  const { width, x, y } = usePlotScales();
  const { from, to } = visibleSegment(line, domain);
  const [lower, upper] = from.price < to.price ? [from, to] : [to, from];
  const point = end === "upper" ? upper : lower;
  const px = x.toPixel(point.quantity);
  const inLeftHalf = px < width / 2;

  return (
    <text
      aria-hidden="true"
      className={cn("fill-current text-xs font-semibold", className)}
      textAnchor={inLeftHalf ? "start" : "end"}
      x={inLeftHalf ? px + LABEL_GAP : px - LABEL_GAP}
      y={Math.max(y.toPixel(point.price) - LABEL_GAP, y.range[1] + LABEL_GAP)}
    >
      {label}
    </text>
  );
}

/** A point along a curve's visible stretch, from its lower-quantity end (0) to its other (1). */
export function pointAlong(line: Line, domain: { price: number; quantity: number }, share: number) {
  const { from, to } = visibleSegment(line, domain);
  const quantity = from.quantity + (to.quantity - from.quantity) * share;
  return { price: priceAt(line, quantity), quantity };
}

export function Crossing({ isBefore, point }: { isBefore: boolean; point: Point }) {
  const { x, y } = usePlotScales();
  const [px, py] = [x.toPixel(point.quantity), y.toPixel(point.price)];

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

/** Arrows along the axes from the old crossing to the new one: what happened to price and quantity. */
export function ChangeArrows({ after, before }: { after: Point; before: Point }) {
  const { x, y } = usePlotScales();
  const markerId = useId();
  const [left, bottom] = [x.range[0], y.range[0]];
  const priceMoves = Math.abs(y.toPixel(after.price) - y.toPixel(before.price)) > DOT_RADIUS;

  const quantityMoves =
    Math.abs(x.toPixel(after.quantity) - x.toPixel(before.quantity)) > DOT_RADIUS;

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
      {priceMoves && (
        <path
          className="fill-none stroke-current"
          d={`M${left + ARROW_OFFSET} ${y.toPixel(before.price)} V${y.toPixel(after.price)}`}
          markerEnd={`url(#${markerId})`}
          strokeWidth={2}
        />
      )}
      {quantityMoves && (
        <path
          className="fill-none stroke-current"
          d={`M${x.toPixel(before.quantity)} ${bottom - ARROW_OFFSET} H${x.toPixel(after.quantity)}`}
          markerEnd={`url(#${markerId})`}
          strokeWidth={2}
        />
      )}
    </g>
  );
}

export function Axes({ fields }: { fields: AxisLabels }) {
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
      <text className="fill-muted-foreground text-xs" x={left} y={top - PRICE_LABEL_RISE}>
        {fields.priceLabel}
      </text>
      <text
        className="fill-muted-foreground text-xs"
        textAnchor="end"
        x={right}
        y={bottom + QUANTITY_LABEL_DROP}
      >
        {fields.quantityLabel}
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
