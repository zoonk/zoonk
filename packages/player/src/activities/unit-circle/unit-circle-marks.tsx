"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { DRAWING_LABEL_HALO } from "../_utils/drawing-label";
import { type TrigName } from "./use-unit-circle-format";

type Vector = { x: number; y: number };

const HALF_TURN = 180;
const LABEL_GAP = 8;
const SEGMENT_WIDTH = 4;
const SIN_LABEL_GAP = 26;
const LABEL_CHAR_WIDTH = 8.5;
const SIN_LABEL_PAST_POINT = 25;

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

type LabelBaseline = "middle" | "text-after-edge" | "text-before-edge";

export function DialLabel({
  anchor,
  baseline = "middle",
  children,
  className,
  point,
}: {
  anchor: "end" | "middle" | "start";
  baseline?: LabelBaseline;
  children: React.ReactNode;
  className?: string;
  point: Vector;
}) {
  return (
    <text
      aria-hidden="true"
      className={cn("text-sm font-semibold tabular-nums", DRAWING_LABEL_HALO, className)}
      dominantBaseline={baseline}
      textAnchor={anchor}
      x={point.x}
      y={point.y}
    >
      {children}
    </text>
  );
}

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

function sinLabelPlacement({
  canvas,
  foot,
  isAbove,
  isLeft,
  label,
  point,
  target,
}: {
  canvas: { width: number };
  foot: Vector;
  isAbove: boolean;
  isLeft: boolean;
  label: string;
  point: Vector;
  target: Vector | null;
}): { anchor: "end" | "middle" | "start"; baseline: LabelBaseline; point: Vector } {
  const labelWidth = label.length * LABEL_CHAR_WIDTH;
  const beside = foot.x + (isLeft ? -1 : 1) * SIN_LABEL_GAP;
  const fits = isLeft ? beside - labelWidth >= 0 : beside + labelWidth <= canvas.width;

  if (fits) {
    return {
      anchor: isLeft ? "end" : "start",
      baseline: "middle",
      point: { x: beside, y: (foot.y + point.y) / 2 },
    };
  }

  const isTargetPast =
    target !== null &&
    Math.abs(target.x - point.x) < labelWidth &&
    (isAbove ? target.y < point.y : target.y > point.y);

  const outermost = isTargetPast ? target.y : point.y;

  return {
    anchor: "middle",
    baseline: isAbove ? "text-after-edge" : "text-before-edge",
    point: {
      x: Math.min(Math.max(foot.x, labelWidth / 2), canvas.width - labelWidth / 2),
      y: outermost + (isAbove ? -1 : 1) * SIN_LABEL_PAST_POINT,
    },
  };
}

export function TrigLegs({
  canvas,
  center,
  formatValue,
  names,
  point,
  show,
  target,
  values,
}: {
  canvas: { width: number };
  center: Vector;
  formatValue: (value: number | null) => string;
  names: Record<TrigName, string>;
  point: Vector;
  show: readonly TrigName[];
  target: Vector | null;
  values: Partial<Record<TrigName, number | null>>;
}) {
  const foot = { x: point.x, y: center.y };
  const isLeft = point.x < center.x;
  const isAbove = point.y <= center.y;
  const sinLabel = `${names.sin} = ${formatValue(values.sin ?? null)}`;

  const sinPlacement = sinLabelPlacement({
    canvas,
    foot,
    isAbove,
    isLeft,
    label: sinLabel,
    point,
    target,
  });

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
            baseline={sinPlacement.baseline}
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
