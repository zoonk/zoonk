"use client";

import { type LinearScale, createLinearScale } from "@zoonk/utils/plot-scale";
import { ActivityPlaceHandle } from "../_components/activity-place-handle";
import { usePlotScales } from "../_components/activity-plot";
import { type Point, type ShiftAxis, shiftRange } from "./line-crossing-model";

export const HANDLE_RADIUS = 14;
export const HANDLE_STROKE = 2.5;
const CHEVRON = 4;

function chevrons({ axis, cx, cy }: { axis: ShiftAxis; cx: number; cy: number }): string {
  return axis === "horizontal"
    ? `M${cx - 2} ${cy - CHEVRON} l-${CHEVRON} ${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx + 2} ${cy - CHEVRON} l${CHEVRON} ${CHEVRON} l-${CHEVRON} ${CHEVRON}`
    : `M${cx - CHEVRON} ${cy - 2} l${CHEVRON} -${CHEVRON} l${CHEVRON} ${CHEVRON} M${cx - CHEVRON} ${cy + 2} l${CHEVRON} ${CHEVRON} l${CHEVRON} -${CHEVRON}`;
}

export function handlePlace({
  amount,
  axis,
  home,
  offset,
  scales,
}: {
  amount: number;
  axis: ShiftAxis;
  home: Point;
  offset: number;
  scales: { x: LinearScale; y: LinearScale };
}) {
  const range = shiftRange(amount);
  const isSideways = axis === "horizontal";
  const along = isSideways ? scales.x : scales.y;
  const start = isSideways ? home.x : home.y;

  const scale = createLinearScale({
    domain: [range.min, range.max],
    range: [along.toPixel(start + range.min), along.toPixel(start + range.max)],
  });

  const [cx, cy] = isSideways
    ? [scale.toPixel(offset), scales.y.toPixel(home.y)]
    : [scales.x.toPixel(home.x), scale.toPixel(offset)];

  return { cx, cy, range, scale };
}

export function LineHandle({
  amount,
  axis,
  className,
  disabled,
  home,
  label,
  offset,
  onChange,
  valueText,
}: {
  amount: number;
  axis: ShiftAxis;
  className: string;
  disabled: boolean;
  home: Point;
  label: string;
  offset: number;
  onChange: (offset: number) => void;
  valueText: string;
}) {
  const scales = usePlotScales();
  const { cx, cy, range, scale } = handlePlace({ amount, axis, home, offset, scales });

  return (
    <ActivityPlaceHandle
      className={className}
      cx={cx}
      cy={cy}
      disabled={disabled}
      label={label}
      onChange={onChange}
      orientation={axis}
      range={range}
      scale={scale}
      value={offset}
      valueText={valueText}
    >
      <circle
        className="fill-background stroke-current"
        cx={cx}
        cy={cy}
        r={HANDLE_RADIUS}
        strokeWidth={HANDLE_STROKE}
      />
      <path
        className="fill-none stroke-current"
        d={chevrons({ axis, cx, cy })}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </ActivityPlaceHandle>
  );
}
