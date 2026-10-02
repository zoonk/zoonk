"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type TrigName } from "./use-unit-circle-format";

type Vector = { x: number; y: number };

const HALF_TURN = 180;
const LABEL_GAP = 8;
const HALO = "[paint-order:stroke] stroke-background stroke-[4px] [stroke-linejoin:round]";
const SEGMENT_WIDTH = 4;
/** Clear of the point's 44px handle, which sits at the top of the sine's side. */
const SIN_LABEL_GAP = 26;
/** A bold small label's average character width, enough to tell whether it fits beside the point. */
const LABEL_CHAR_WIDTH = 8.5;
/** How far from the canvas's top or bottom edge a corner label sits. */
const CORNER_INSET = 10;

const TRIG_TONES: Record<TrigName, { stroke: string; text: string }> = {
  cos: { stroke: "stroke-viz-secondary", text: "fill-viz-secondary" },
  sin: { stroke: "stroke-viz-highlight", text: "fill-viz-highlight" },
  tan: { stroke: "stroke-viz-accent", text: "fill-viz-accent" },
};

export function onCircle(center: Vector, radius: number, degrees: number): Vector {
  const radians = (degrees * Math.PI) / HALF_TURN;
  return { x: center.x + Math.cos(radians) * radius, y: center.y - Math.sin(radians) * radius };
}

export function arcPath(center: Vector, radius: number, degrees: number): string {
  const end = onCircle(center, radius, degrees);
  const large = degrees > HALF_TURN ? 1 : 0;

  return `M${center.x + radius} ${center.y} A${radius} ${radius} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function DialLabel({
  anchor,
  children,
  className,
  point,
}: {
  anchor: "end" | "middle" | "start";
  children: React.ReactNode;
  className?: string;
  point: Vector;
}) {
  return (
    <text
      aria-hidden="true"
      className={cn("text-sm font-bold tabular-nums", HALO, className)}
      dominantBaseline="middle"
      textAnchor={anchor}
      x={point.x}
      y={point.y}
    >
      {children}
    </text>
  );
}

/**
 * The tangent drawn where it lives: on the upright line touching the circle at angle 0, as far
 * up or down as the line through the center and the point reaches it. Clipped to the canvas.
 */
export function TangentMark({
  center,
  formatValue,
  limit,
  name,
  radius,
  value,
}: {
  center: Vector;
  formatValue: (value: number | null) => string;
  limit: number;
  name: string;
  radius: number;
  value: number | null;
}) {
  if (value === null) {
    return null;
  }

  const reach = Math.max(Math.min(-value * radius, limit), -limit);
  const top = { x: center.x + radius, y: center.y + reach };

  return (
    <g aria-hidden="true">
      <path
        className="stroke-viz-accent/60 fill-none"
        d={`M${center.x} ${center.y} L${top.x} ${top.y}`}
        strokeDasharray="3 4"
        strokeWidth={1.5}
      />
      <path
        className={TRIG_TONES.tan.stroke}
        d={`M${top.x} ${center.y} V${top.y}`}
        strokeLinecap="round"
        strokeWidth={SEGMENT_WIDTH}
      />
      <DialLabel
        anchor="end"
        className={TRIG_TONES.tan.text}
        point={{ x: top.x - LABEL_GAP, y: top.y }}
      >
        {`${name} = ${formatValue(value)}`}
      </DialLabel>
    </g>
  );
}

/**
 * Where the sine's label goes: beside its side, away from the circle, or when that runs past the
 * canvas edge (a narrow phone, the point near the horizontal axis), in a corner on its side,
 * across the axis from the point: clear of the circle, the point, the target and the tangent.
 */
function sinLabelPlacement({
  canvas,
  foot,
  isAbove,
  isLeft,
  label,
  point,
}: {
  canvas: { height: number; width: number };
  foot: Vector;
  isAbove: boolean;
  isLeft: boolean;
  label: string;
  point: Vector;
}): { anchor: "end" | "start"; point: Vector } {
  const labelWidth = label.length * LABEL_CHAR_WIDTH;
  const beside = foot.x + (isLeft ? -1 : 1) * SIN_LABEL_GAP;
  const fits = isLeft ? beside - labelWidth >= 0 : beside + labelWidth <= canvas.width;

  if (fits) {
    return { anchor: isLeft ? "end" : "start", point: { x: beside, y: (foot.y + point.y) / 2 } };
  }

  return {
    anchor: isLeft ? "start" : "end",
    point: {
      x: isLeft ? 0 : canvas.width,
      y: isAbove ? canvas.height - CORNER_INSET : CORNER_INSET,
    },
  };
}

/**
 * The sides of the triangle the radius makes: the cosine along the horizontal axis and the sine
 * straight up to the point, each labeled with its value.
 */
export function TrigLegs({
  canvas,
  center,
  formatValue,
  names,
  point,
  show,
  values,
}: {
  /** The canvas size, which the labels stay inside. */
  canvas: { height: number; width: number };
  center: Vector;
  formatValue: (value: number | null) => string;
  names: Record<TrigName, string>;
  point: Vector;
  show: readonly TrigName[];
  values: Partial<Record<TrigName, number | null>>;
}) {
  const foot = { x: point.x, y: center.y };
  const isLeft = point.x < center.x;
  /* On the axis the cosine's label goes under it, leaving the space above for the angle. */
  const isAbove = point.y <= center.y;
  const sinLabel = `${names.sin} = ${formatValue(values.sin ?? null)}`;
  const sinPlacement = sinLabelPlacement({ canvas, foot, isAbove, isLeft, label: sinLabel, point });

  return (
    <g aria-hidden="true">
      {show.includes("cos") && (
        <>
          <path
            className={TRIG_TONES.cos.stroke}
            d={`M${center.x} ${center.y} H${foot.x}`}
            strokeLinecap="round"
            strokeWidth={SEGMENT_WIDTH}
          />
          <DialLabel
            anchor="middle"
            className={TRIG_TONES.cos.text}
            point={{
              x: (center.x + foot.x) / 2,
              y: center.y + (isAbove ? 1 : -1) * (LABEL_GAP * 2),
            }}
          >
            {`${names.cos} = ${formatValue(values.cos ?? null)}`}
          </DialLabel>
        </>
      )}

      {show.includes("sin") && (
        <>
          <path
            className={TRIG_TONES.sin.stroke}
            d={`M${foot.x} ${foot.y} V${point.y}`}
            strokeLinecap="round"
            strokeWidth={SEGMENT_WIDTH}
          />
          <DialLabel
            anchor={sinPlacement.anchor}
            className={TRIG_TONES.sin.text}
            point={sinPlacement.point}
          >
            {sinLabel}
          </DialLabel>
        </>
      )}
    </g>
  );
}
